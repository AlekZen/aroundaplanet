import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockRequireAuth = vi.hoisted(() => vi.fn())
const mockRequirePermission = vi.hoisted(() => vi.fn())
const mockUserDocGet = vi.hoisted(() => vi.fn())
const mockUserDocUpdate = vi.hoisted(() => vi.fn())
const mockFieldValueServerTimestamp = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: mockRequireAuth,
}))

vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: mockRequirePermission,
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: vi.fn(() => ({
            get: mockUserDocGet,
            update: mockUserDocUpdate,
          })),
        }
      }
      return {}
    }),
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: mockFieldValueServerTimestamp,
  },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: vi.fn((error: unknown) => {
    const err = error as { code?: string; message?: string; status?: number; retryable?: boolean }
    if (err.code && err.status) {
      return Response.json(
        { code: err.code, message: err.message ?? 'Error', retryable: err.retryable ?? false },
        { status: err.status }
      )
    }
    return Response.json(
      { code: 'INTERNAL_ERROR', message: 'Error interno', retryable: true },
      { status: 500 }
    )
  }),
}))

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/users/user1/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(uid: string) {
  return { params: Promise.resolve({ uid }) }
}

const FAKE_TIMESTAMP = { _seconds: 1234567890, _nanoseconds: 0 }

describe('PATCH /api/users/[uid]/profile', () => {
  beforeEach(() => {
    mockRequireAuth.mockReset()
    mockRequirePermission.mockReset()
    mockUserDocGet.mockReset()
    mockUserDocUpdate.mockReset()
    mockFieldValueServerTimestamp.mockReset()

    // Default: caller is owner
    mockRequireAuth.mockResolvedValue({ uid: 'user1', roles: ['cliente'] })
    mockUserDocGet.mockResolvedValue({ exists: true, data: () => ({ roles: ['cliente'] }) })
    mockUserDocUpdate.mockResolvedValue(undefined)
    mockFieldValueServerTimestamp.mockReturnValue(FAKE_TIMESTAMP)
  })

  describe('authorization', () => {
    it('allows owner to update own profile', async () => {
      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({ section: 'personal', data: { firstName: 'Juan', lastName: 'Perez' } }),
        makeParams('user1')
      )

      expect(response.status).toBe(200)
      expect(mockRequirePermission).not.toHaveBeenCalled()
    })

    it('allows admin to update another user profile with users:manage', async () => {
      mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
      mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })

      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({ section: 'personal', data: { firstName: 'Juan', lastName: 'Perez' } }),
        makeParams('user1')
      )

      expect(response.status).toBe(200)
      expect(mockRequirePermission).toHaveBeenCalledWith('users:manage')
    })

    it('returns 403 when non-owner lacks users:manage permission', async () => {
      const { AppError } = await import('@/lib/errors/AppError')
      mockRequireAuth.mockResolvedValue({ uid: 'other-user', roles: ['cliente'] })
      mockRequirePermission.mockRejectedValue(
        new AppError('INSUFFICIENT_PERMISSIONS', 'Permiso requerido', 403, false)
      )

      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({ section: 'personal', data: { firstName: 'Juan', lastName: 'Perez' } }),
        makeParams('user1')
      )

      expect(response.status).toBe(403)
    })

    it('returns 401 when not authenticated', async () => {
      const { AppError } = await import('@/lib/errors/AppError')
      mockRequireAuth.mockRejectedValue(
        new AppError('AUTH_REQUIRED', 'Autenticacion requerida', 401, false)
      )

      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({ section: 'personal', data: { firstName: 'Juan', lastName: 'Perez' } }),
        makeParams('user1')
      )

      expect(response.status).toBe(401)
    })
  })

  describe('personal section', () => {
    it('updates firstName, lastName, displayName, and phone', async () => {
      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({
          section: 'personal',
          data: { firstName: 'Juan', lastName: 'Perez', phone: '+523331234567' },
        }),
        makeParams('user1')
      )

      expect(response.status).toBe(200)
      expect(mockUserDocUpdate).toHaveBeenCalledWith({
        firstName: 'Juan',
        lastName: 'Perez',
        displayName: 'Juan Perez',
        phone: '+523331234567',
        updatedAt: FAKE_TIMESTAMP,
      })
    })

    it('syncs displayName from firstName + lastName', async () => {
      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({ section: 'personal', data: { firstName: 'Maria', lastName: 'Lopez' } }),
        makeParams('user1')
      )

      expect(response.status).toBe(200)
      expect(mockUserDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Maria Lopez' })
      )
    })

    it('sets phone to null when empty string provided', async () => {
      const { PATCH } = await import('./route')
      await PATCH(
        makeRequest({ section: 'personal', data: { firstName: 'Juan', lastName: 'Perez', phone: '' } }),
        makeParams('user1')
      )

      expect(mockUserDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ phone: null })
      )
    })

    it('does not include phone when not provided', async () => {
      const { PATCH } = await import('./route')
      await PATCH(
        makeRequest({ section: 'personal', data: { firstName: 'Juan', lastName: 'Perez' } }),
        makeParams('user1')
      )

      const updateArg = mockUserDocUpdate.mock.calls[0][0]
      expect(updateArg).not.toHaveProperty('phone')
    })
  })

  describe('fiscal section', () => {
    it('updates fiscalData object', async () => {
      const fiscalData = {
        rfc: 'XAXX010101000',
        razonSocial: 'Mi Empresa',
        regimenFiscal: '601',
        domicilioFiscal: 'Calle 123',
        usoCFDI: 'G01',
      }

      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({ section: 'fiscal', data: fiscalData }),
        makeParams('user1')
      )

      expect(response.status).toBe(200)
      expect(mockUserDocUpdate).toHaveBeenCalledWith({
        fiscalData,
        updatedAt: FAKE_TIMESTAMP,
      })
    })
  })

  describe('bank section', () => {
    it('updates bankData for agent role', async () => {
      mockUserDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ roles: ['agente'] }),
      })

      const bankData = {
        banco: 'BBVA',
        numeroCuenta: '1234567890123456',
        clabe: '123456789012345678',
        titularCuenta: 'Juan Perez',
      }

      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({ section: 'bank', data: bankData }),
        makeParams('user1')
      )

      expect(response.status).toBe(200)
      expect(mockUserDocUpdate).toHaveBeenCalledWith({
        bankData,
        updatedAt: FAKE_TIMESTAMP,
      })
    })

    it('returns 403 for bankData when user is not agent', async () => {
      mockUserDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ roles: ['cliente'] }),
      })

      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({
          section: 'bank',
          data: {
            banco: 'BBVA',
            numeroCuenta: '1234567890123456',
            clabe: '123456789012345678',
            titularCuenta: 'Juan Perez',
          },
        }),
        makeParams('user1')
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.code).toBe('BANK_DATA_AGENTS_ONLY')
    })

    it('returns 404 when user not found for bank section', async () => {
      mockUserDocGet.mockResolvedValue({ exists: false })

      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({
          section: 'bank',
          data: {
            banco: 'BBVA',
            numeroCuenta: '1234567890123456',
            clabe: '123456789012345678',
            titularCuenta: 'Juan Perez',
          },
        }),
        makeParams('user1')
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.code).toBe('USER_NOT_FOUND')
    })
  })

  describe('validation', () => {
    it('returns 400 for invalid section', async () => {
      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({ section: 'invalid', data: { foo: 'bar' } }),
        makeParams('user1')
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.code).toBe('PROFILE_VALIDATION_ERROR')
    })

    it('returns 400 for missing firstName in personal section', async () => {
      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({ section: 'personal', data: { lastName: 'Perez' } }),
        makeParams('user1')
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.code).toBe('PROFILE_VALIDATION_ERROR')
    })

    it('returns 400 for invalid RFC in fiscal section', async () => {
      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({
          section: 'fiscal',
          data: {
            rfc: 'invalid',
            razonSocial: 'Mi Empresa',
            regimenFiscal: '601',
            domicilioFiscal: 'Calle 123',
            usoCFDI: 'G01',
          },
        }),
        makeParams('user1')
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.code).toBe('PROFILE_VALIDATION_ERROR')
    })

    it('returns 400 for invalid CLABE in bank section', async () => {
      mockUserDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ roles: ['agente'] }),
      })

      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({
          section: 'bank',
          data: {
            banco: 'BBVA',
            numeroCuenta: '1234567890123456',
            clabe: '12345', // too short
            titularCuenta: 'Juan Perez',
          },
        }),
        makeParams('user1')
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.code).toBe('PROFILE_VALIDATION_ERROR')
    })
  })

  describe('response', () => {
    it('returns updatedFields in response', async () => {
      const { PATCH } = await import('./route')
      const response = await PATCH(
        makeRequest({ section: 'personal', data: { firstName: 'Juan', lastName: 'Perez' } }),
        makeParams('user1')
      )

      const body = await response.json()
      expect(body.updatedFields).toBeDefined()
      expect(body.updatedFields.firstName).toBe('Juan')
      expect(body.updatedFields.lastName).toBe('Perez')
      expect(body.updatedFields.displayName).toBe('Juan Perez')
    })

    it('always includes updatedAt in update', async () => {
      const { PATCH } = await import('./route')
      await PATCH(
        makeRequest({ section: 'personal', data: { firstName: 'Juan', lastName: 'Perez' } }),
        makeParams('user1')
      )

      expect(mockUserDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ updatedAt: FAKE_TIMESTAMP })
      )
    })
  })
})
