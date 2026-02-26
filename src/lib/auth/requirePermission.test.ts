import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors/AppError'
import type { AuthClaims } from './requireAuth'

const mockRequireAuth = vi.fn()
const mockHasPermission = vi.fn()

vi.mock('./requireAuth', () => ({
  requireAuth: mockRequireAuth,
}))

vi.mock('./permissions', () => ({
  hasPermission: mockHasPermission,
}))

const makeClaimsFor = (roles: string[], agentId?: string): AuthClaims => ({
  uid: 'user-test',
  roles: roles as AuthClaims['roles'],
  agentId,
})

describe('requirePermission', () => {
  beforeEach(() => {
    mockRequireAuth.mockReset()
    mockHasPermission.mockReset()
  })

  it('retorna claims cuando el usuario tiene el permiso requerido', async () => {
    const claims = makeClaimsFor(['cliente', 'agente'])
    mockRequireAuth.mockResolvedValue(claims)
    mockHasPermission.mockResolvedValue(true)

    const { requirePermission } = await import('./requirePermission')
    const result = await requirePermission('trips:read')

    expect(mockHasPermission).toHaveBeenCalledWith(['cliente', 'agente'], 'trips:read')
    expect(result).toEqual(claims)
  })

  it('lanza INSUFFICIENT_PERMISSION con status 403 cuando el usuario no tiene el permiso', async () => {
    mockRequireAuth.mockResolvedValue(makeClaimsFor(['cliente']))
    mockHasPermission.mockResolvedValue(false)

    const { requirePermission } = await import('./requirePermission')

    try {
      await requirePermission('payments:write')
      expect.fail('Debe lanzar error')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      const appErr = err as AppError
      expect(appErr.code).toBe('INSUFFICIENT_PERMISSION')
      expect(appErr.status).toBe(403)
      expect(appErr.retryable).toBe(false)
      expect(appErr.message).toContain('payments:write')
    }
  })

  it('retorna claims cuando roles multiples combinados otorgan el permiso', async () => {
    const claims = makeClaimsFor(['cliente', 'agente', 'admin'])
    mockRequireAuth.mockResolvedValue(claims)
    mockHasPermission.mockResolvedValue(true)

    const { requirePermission } = await import('./requirePermission')
    const result = await requirePermission('users:manage')

    expect(mockHasPermission).toHaveBeenCalledWith(['cliente', 'agente', 'admin'], 'users:manage')
    expect(result).toEqual(claims)
  })

  it('propaga AUTH_REQUIRED de requireAuth cuando no hay cookie', async () => {
    const authErr = new AppError('AUTH_REQUIRED', 'Sesion requerida', 401, false)
    mockRequireAuth.mockRejectedValue(authErr)

    const { requirePermission } = await import('./requirePermission')

    try {
      await requirePermission('trips:read')
      expect.fail('Debe lanzar error')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      const appErr = err as AppError
      expect(appErr.code).toBe('AUTH_REQUIRED')
      expect(appErr.status).toBe(401)
    }
  })

  it('propaga AUTH_SESSION_EXPIRED de requireAuth cuando la sesion expiro', async () => {
    const authErr = new AppError('AUTH_SESSION_EXPIRED', 'Sesion expirada o revocada', 401, false)
    mockRequireAuth.mockRejectedValue(authErr)

    const { requirePermission } = await import('./requirePermission')

    try {
      await requirePermission('trips:read')
      expect.fail('Debe lanzar error')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      const appErr = err as AppError
      expect(appErr.code).toBe('AUTH_SESSION_EXPIRED')
      expect(appErr.status).toBe(401)
    }
  })
})
