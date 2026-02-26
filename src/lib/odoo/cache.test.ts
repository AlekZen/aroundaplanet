import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'

const { mockGet, mockSet, mockCollection } = vi.hoisted(() => {
  const mockGet = vi.fn()
  const mockSet = vi.fn()
  const _mockDoc: ReturnType<typeof vi.fn> = vi.fn()
  const mockCollection = vi.fn()

  _mockDoc.mockReturnValue({
    get: mockGet,
    set: mockSet,
    collection: vi.fn(() => ({ doc: _mockDoc })),
  })
  mockCollection.mockReturnValue({ doc: _mockDoc })

  return { mockGet, mockSet, mockCollection }
})

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: mockCollection,
  },
}))

vi.mock('@/config/odoo', () => ({
  ODOO_CACHE_TTL: {
    'product.product': 24 * 60 * 60 * 1000,
    'res.partner': 1 * 60 * 60 * 1000,
    'sale.order': 15 * 60 * 1000,
  },
}))

import { getCached, setCache, withCacheFallback } from './cache'

describe('getCached', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockSet.mockReset()
  })

  it('retorna null cuando no hay cache', async () => {
    mockGet.mockResolvedValue({ exists: false })

    const result = await getCached('res.partner', 'test-key')
    expect(result).toBeNull()
  })

  it('retorna datos no-stale cuando TTL es valido', async () => {
    const now = new Date()
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        data: [{ id: 1, name: 'Test' }],
        cachedAt: Timestamp.fromDate(now),
        odooModel: 'res.partner',
        cacheKey: 'test-key',
      }),
    })

    const result = await getCached<unknown[]>('res.partner', 'test-key')
    expect(result).not.toBeNull()
    expect(result!.data).toEqual([{ id: 1, name: 'Test' }])
    expect(result!.isStale).toBe(false)
  })

  it('marca como stale cuando TTL expiro', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        data: [{ id: 1 }],
        cachedAt: Timestamp.fromDate(twoHoursAgo),
        odooModel: 'res.partner',
        cacheKey: 'test-key',
      }),
    })

    const result = await getCached<unknown[]>('res.partner', 'test-key')
    expect(result).not.toBeNull()
    expect(result!.isStale).toBe(true)
  })

  it('retorna null cuando la estructura del cache es invalida', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ invalid: 'structure' }),
    })

    const result = await getCached('res.partner', 'test-key')
    expect(result).toBeNull()
  })
})

describe('setCache', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockSet.mockReset()
  })

  it('escribe data con cachedAt timestamp', async () => {
    mockSet.mockResolvedValue(undefined)

    await setCache('res.partner', 'test-key', [{ id: 1 }])

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ id: 1 }],
        odooModel: 'res.partner',
        cacheKey: 'test-key',
        cachedAt: expect.any(Timestamp),
      })
    )
  })
})

describe('withCacheFallback', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockSet.mockReset()
    vi.restoreAllMocks()
  })

  it('retorna datos frescos de Odoo cuando cache no existe', async () => {
    mockGet.mockResolvedValue({ exists: false })
    mockSet.mockResolvedValue(undefined)

    const fetchFn = vi.fn().mockResolvedValue([{ id: 1, name: 'Fresh' }])

    const result = await withCacheFallback('res.partner', 'key', fetchFn)

    expect(result.data).toEqual([{ id: 1, name: 'Fresh' }])
    expect(result.isStale).toBe(false)
    expect(fetchFn).toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalled()
  })

  it('retorna cache cuando TTL es valido (sin llamar a Odoo)', async () => {
    const now = new Date()
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        data: [{ id: 1, name: 'Cached' }],
        cachedAt: Timestamp.fromDate(now),
        odooModel: 'res.partner',
        cacheKey: 'key',
      }),
    })

    const fetchFn = vi.fn()

    const result = await withCacheFallback('res.partner', 'key', fetchFn)

    expect(result.data).toEqual([{ id: 1, name: 'Cached' }])
    expect(result.isStale).toBe(false)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('llama a Odoo cuando cache esta stale y retorna datos frescos', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        data: [{ id: 1, name: 'Old' }],
        cachedAt: Timestamp.fromDate(twoHoursAgo),
        odooModel: 'res.partner',
        cacheKey: 'key',
      }),
    })
    mockSet.mockResolvedValue(undefined)

    const fetchFn = vi.fn().mockResolvedValue([{ id: 1, name: 'Fresh' }])

    const result = await withCacheFallback('res.partner', 'key', fetchFn)

    expect(result.data).toEqual([{ id: 1, name: 'Fresh' }])
    expect(result.isStale).toBe(false)
    expect(fetchFn).toHaveBeenCalled()
  })

  it('retorna cache stale cuando Odoo falla y logea el error', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        data: [{ id: 1, name: 'Stale' }],
        cachedAt: Timestamp.fromDate(twoHoursAgo),
        odooModel: 'res.partner',
        cacheKey: 'key',
      }),
    })

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchFn = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'))

    const result = await withCacheFallback('res.partner', 'key', fetchFn)

    expect(result.data).toEqual([{ id: 1, name: 'Stale' }])
    expect(result.isStale).toBe(true)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[OdooCache]'),
      expect.any(Error)
    )
  })

  it('lanza error cuando Odoo falla y no hay cache', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGet.mockResolvedValue({ exists: false })

    const fetchFn = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'))

    await expect(withCacheFallback('res.partner', 'key', fetchFn)).rejects.toMatchObject({
      code: 'ODOO_UNAVAILABLE',
    })
  })
})
