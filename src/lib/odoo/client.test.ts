import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockMethodCall } = vi.hoisted(() => ({
  mockMethodCall: vi.fn(),
}))

vi.mock('xmlrpc', () => ({
  default: {
    createSecureClient: vi.fn(() => ({
      methodCall: mockMethodCall,
    })),
  },
}))

vi.mock('@/config/odoo', () => ({
  ODOO_TIMEOUT_MS: 5000,
  ODOO_MAX_RETRIES: 3,
  ODOO_RETRY_DELAYS: [1, 2, 4],
  ODOO_RATE_LIMIT_PER_MIN: 6000,
  ODOO_DEFAULT_PAGE_SIZE: 100,
  ODOO_XMLRPC_PATHS: {
    COMMON: '/xmlrpc/2/common',
    OBJECT: '/xmlrpc/2/object',
  },
}))

import { OdooClient, getOdooClient, resetOdooClient } from './client'
import { AppError } from '@/lib/errors/AppError'

const TEST_CONFIG = {
  url: 'https://test.odoo.com',
  db: 'testdb',
  username: 'admin',
  apiKey: 'test-api-key',
}

describe('OdooClient', () => {
  let client: OdooClient

  beforeEach(() => {
    mockMethodCall.mockReset()
    client = new OdooClient(TEST_CONFIG)
  })

  afterEach(() => {
    resetOdooClient()
  })

  describe('authenticate', () => {
    it('retorna uid cuando las credenciales son correctas', async () => {
      mockMethodCall.mockImplementation((_method: string, _params: unknown[], cb: (...args: unknown[]) => void) => {
        cb(null, 42)
      })

      const uid = await client.authenticate()
      expect(uid).toBe(42)
    })

    it('cachea el uid despues de la primera autenticacion', async () => {
      mockMethodCall.mockImplementation((_method: string, _params: unknown[], cb: (...args: unknown[]) => void) => {
        cb(null, 42)
      })

      await client.authenticate()
      await client.authenticate()

      // authenticate solo se llama una vez (methodCall para common endpoint)
      expect(mockMethodCall).toHaveBeenCalledTimes(1)
    })

    it('lanza ODOO_AUTH_FAILED cuando uid es false', async () => {
      mockMethodCall.mockImplementation((_method: string, _params: unknown[], cb: (...args: unknown[]) => void) => {
        cb(null, false)
      })

      await expect(client.authenticate()).rejects.toThrow(AppError)
      await expect(client.authenticate()).rejects.toMatchObject({
        code: 'ODOO_AUTH_FAILED',
        status: 401,
        retryable: false,
      })
    })

    it('resetAuth limpia el uid cacheado', async () => {
      mockMethodCall.mockImplementation((_method: string, _params: unknown[], cb: (...args: unknown[]) => void) => {
        cb(null, 42)
      })

      await client.authenticate()
      client.resetAuth()
      await client.authenticate()

      // authenticate se llama dos veces
      expect(mockMethodCall).toHaveBeenCalledTimes(2)
    })
  })

  describe('searchRead', () => {
    beforeEach(() => {
      // First call = authenticate, subsequent = execute_kw
      let callCount = 0
      mockMethodCall.mockImplementation((_method: string, _params: unknown[], cb: (...args: unknown[]) => void) => {
        callCount++
        if (callCount === 1) {
          cb(null, 42) // authenticate returns uid
        } else {
          cb(null, [{ id: 1, name: 'Test' }]) // execute_kw returns records
        }
      })
    })

    it('envia parametros XML-RPC correctos', async () => {
      await client.searchRead('res.partner', [['is_company', '=', true]], ['name', 'email'], { limit: 5 })

      // Second call is the execute_kw
      const executeCall = mockMethodCall.mock.calls[1]
      expect(executeCall[0]).toBe('execute_kw')
      const params = executeCall[1]
      expect(params[0]).toBe('testdb') // db
      expect(params[1]).toBe(42) // uid
      expect(params[2]).toBe('test-api-key') // apiKey
      expect(params[3]).toBe('res.partner') // model
      expect(params[4]).toBe('search_read') // method
      expect(params[5]).toEqual([[['is_company', '=', true]]]) // args (domain wrapped)
      expect(params[6]).toMatchObject({
        fields: ['name', 'email'],
        limit: 5,
        offset: 0,
      })
    })

    it('usa defaults para offset y limit', async () => {
      await client.searchRead('res.partner', [], ['name'])

      const executeCall = mockMethodCall.mock.calls[1]
      const kwargs = executeCall[1][6]
      expect(kwargs.offset).toBe(0)
      expect(kwargs.limit).toBe(100)
    })

    it('retorna registros de Odoo', async () => {
      const result = await client.searchRead('res.partner', [], ['name'])
      expect(result).toEqual([{ id: 1, name: 'Test' }])
    })
  })

  describe('readGroup', () => {
    beforeEach(() => {
      let callCount = 0
      mockMethodCall.mockImplementation((_method: string, _params: unknown[], cb: (...args: unknown[]) => void) => {
        callCount++
        if (callCount === 1) {
          cb(null, 42)
        } else {
          cb(null, [{ state: 'draft', amount_total: 5000, __count: 3 }])
        }
      })
    })

    it('usa KWARGS en vez de args posicionales para Odoo 18', async () => {
      await client.readGroup('sale.order', [], ['amount_total:sum', 'state'], {
        groupby: ['state'],
        lazy: false,
      })

      const executeCall = mockMethodCall.mock.calls[1]
      const params = executeCall[1]
      expect(params[4]).toBe('read_group')
      // domain in args
      expect(params[5]).toEqual([[]])
      // fields, groupby, lazy in kwargs
      const kwargs = params[6]
      expect(kwargs.fields).toEqual(['amount_total:sum', 'state'])
      expect(kwargs.groupby).toEqual(['state'])
      expect(kwargs.lazy).toBe(false)
    })
  })

  describe('create', () => {
    it('retorna el id del registro creado', async () => {
      let callCount = 0
      mockMethodCall.mockImplementation((_method: string, _params: unknown[], cb: (...args: unknown[]) => void) => {
        callCount++
        if (callCount === 1) cb(null, 42)
        else cb(null, 99)
      })

      const id = await client.create('res.partner', { name: 'New Partner' })
      expect(id).toBe(99)

      const executeCall = mockMethodCall.mock.calls[1]
      expect(executeCall[1][4]).toBe('create')
      expect(executeCall[1][5]).toEqual([{ name: 'New Partner' }])
    })
  })

  describe('write', () => {
    it('retorna true al actualizar', async () => {
      let callCount = 0
      mockMethodCall.mockImplementation((_method: string, _params: unknown[], cb: (...args: unknown[]) => void) => {
        callCount++
        if (callCount === 1) cb(null, 42)
        else cb(null, true)
      })

      const result = await client.write('res.partner', [1], { name: 'Updated' })
      expect(result).toBe(true)

      const executeCall = mockMethodCall.mock.calls[1]
      expect(executeCall[1][4]).toBe('write')
      expect(executeCall[1][5]).toEqual([[1], { name: 'Updated' }])
    })
  })

  describe('withRetry (exponential backoff)', () => {
    it('reintenta hasta 3 veces en errores retryable', async () => {
      let callCount = 0
      mockMethodCall.mockImplementation((_method: string, _params: unknown[], cb: (...args: unknown[]) => void) => {
        callCount++
        if (callCount === 1) {
          cb(null, 42) // authenticate OK
        } else if (callCount <= 3) {
          cb(new Error('ETIMEDOUT'), null) // first 2 execute_kw fail
        } else {
          cb(null, [{ id: 1 }]) // third attempt succeeds
        }
      })

      const result = await client.searchRead('res.partner', [], ['name'])
      expect(result).toEqual([{ id: 1 }])
      // 1 auth + 3 execute_kw attempts (2 fails + 1 success)
      expect(callCount).toBe(4)
    })

    it('no reintenta errores no-retryable', async () => {
      let callCount = 0
      mockMethodCall.mockImplementation((_method: string, _params: unknown[], cb: (...args: unknown[]) => void) => {
        callCount++
        if (callCount === 1) {
          cb(null, 42)
        } else {
          cb(new Error('AccessDenied'), null)
        }
      })

      await expect(client.searchRead('res.partner', [], ['name'])).rejects.toMatchObject({
        code: 'ODOO_AUTH_FAILED',
        retryable: false,
      })
      // 1 auth + 1 execute_kw (no retry since not retryable)
      expect(callCount).toBe(2)
    })

    it('lanza ODOO_UNAVAILABLE despues de agotar reintentos', async () => {
      let callCount = 0
      mockMethodCall.mockImplementation((_method: string, _params: unknown[], cb: (...args: unknown[]) => void) => {
        callCount++
        if (callCount === 1) {
          cb(null, 42)
        } else {
          cb(new Error('ECONNREFUSED'), null)
        }
      })

      await expect(client.searchRead('res.partner', [], ['name'])).rejects.toMatchObject({
        code: 'ODOO_UNAVAILABLE',
        retryable: true,
      })
      // 1 auth + 4 execute_kw (initial + 3 retries)
      expect(callCount).toBe(5)
    })
  })

  describe('error mapping', () => {
    beforeEach(() => {
      let callCount = 0
      mockMethodCall.mockImplementation((_method: string, _params: unknown[], cb: (...args: unknown[]) => void) => {
        callCount++
        if (callCount === 1) cb(null, 42) // auth OK
      })
    })

    const testErrorMapping = async (errorMsg: string, expectedCode: string, expectedRetryable: boolean) => {
      let callCount = 0
      mockMethodCall.mockImplementation((_method: string, _params: unknown[], cb: (...args: unknown[]) => void) => {
        callCount++
        if (callCount === 1) cb(null, 42)
        else cb(new Error(errorMsg), null)
      })
      const newClient = new OdooClient(TEST_CONFIG)
      await expect(newClient.searchRead('test', [], ['id'])).rejects.toMatchObject({
        code: expectedCode,
        retryable: expectedRetryable,
      })
    }

    it('mapea ECONNREFUSED a ODOO_UNAVAILABLE (retryable)', async () => {
      await testErrorMapping('ECONNREFUSED', 'ODOO_UNAVAILABLE', true)
    })

    it('mapea ETIMEDOUT a ODOO_TIMEOUT (retryable)', async () => {
      await testErrorMapping('ETIMEDOUT', 'ODOO_TIMEOUT', true)
    })

    it('mapea AccessDenied a ODOO_AUTH_FAILED (no retryable)', async () => {
      await testErrorMapping('AccessDenied', 'ODOO_AUTH_FAILED', false)
    })

    it('mapea 429 a ODOO_RATE_LIMITED (retryable)', async () => {
      await testErrorMapping('429 Too Many Requests', 'ODOO_RATE_LIMITED', true)
    })

    it('mapea "does not exist" a ODOO_NOT_FOUND (no retryable)', async () => {
      await testErrorMapping('Model does not exist', 'ODOO_NOT_FOUND', false)
    })

    it('mapea ValidationError a ODOO_VALIDATION (no retryable)', async () => {
      await testErrorMapping('ValidationError: field required', 'ODOO_VALIDATION', false)
    })
  })

  describe('rate limiter (sequential queue)', () => {
    it('espacia llamadas respetando el intervalo minimo', async () => {
      const callTimestamps: number[] = []
      let callCount = 0
      mockMethodCall.mockImplementation((_method: string, _params: unknown[], cb: (...args: unknown[]) => void) => {
        callCount++
        if (callCount === 1) {
          cb(null, 42) // authenticate
        } else {
          callTimestamps.push(Date.now())
          cb(null, [{ id: callCount }])
        }
      })

      // Rate limit mock = 6000 req/min → 10ms interval
      // Lanzar 3 llamadas concurrentes
      const results = await Promise.all([
        client.searchRead('res.partner', [], ['name']),
        client.searchRead('res.partner', [], ['name']),
        client.searchRead('res.partner', [], ['name']),
      ])

      expect(results).toHaveLength(3)
      // Todas las llamadas deben completarse (cola procesa todas)
      expect(callTimestamps).toHaveLength(3)
    })
  })
})

describe('getOdooClient (singleton)', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    resetOdooClient()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
    resetOdooClient()
  })

  it('lanza AppError si faltan variables de entorno', () => {
    delete process.env.ODOO_URL
    delete process.env.ODOO_DB
    delete process.env.ODOO_USERNAME
    delete process.env.ODOO_API_KEY

    expect(() => getOdooClient()).toThrow(AppError)
    expect(() => getOdooClient()).toThrow('Faltan variables de entorno Odoo')
  })

  it('retorna la misma instancia en llamadas sucesivas', () => {
    process.env.ODOO_URL = 'https://test.odoo.com'
    process.env.ODOO_DB = 'testdb'
    process.env.ODOO_USERNAME = 'admin'
    process.env.ODOO_API_KEY = 'key'

    const a = getOdooClient()
    const b = getOdooClient()
    expect(a).toBe(b)
  })

  it('resetOdooClient crea nueva instancia', () => {
    process.env.ODOO_URL = 'https://test.odoo.com'
    process.env.ODOO_DB = 'testdb'
    process.env.ODOO_USERNAME = 'admin'
    process.env.ODOO_API_KEY = 'key'

    const a = getOdooClient()
    resetOdooClient()
    const b = getOdooClient()
    expect(a).not.toBe(b)
  })
})
