import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors/AppError'
import type { AuthClaims } from './requireAuth'

const mockRequireAuth = vi.fn()

vi.mock('./requireAuth', () => ({
  requireAuth: mockRequireAuth,
}))

const makeClaimsFor = (roles: string[], agentId?: string): AuthClaims => ({
  uid: 'user-test',
  roles: roles as AuthClaims['roles'],
  agentId,
})

describe('requireRole', () => {
  beforeEach(() => {
    mockRequireAuth.mockReset()
  })

  it('retorna claims cuando el usuario tiene el rol requerido', async () => {
    const claims = makeClaimsFor(['cliente', 'admin'])
    mockRequireAuth.mockResolvedValue(claims)

    const { requireRole } = await import('./requireRole')
    const result = await requireRole('admin')

    expect(result).toEqual(claims)
  })

  it('lanza INSUFFICIENT_ROLE con status 403 cuando el usuario no tiene el rol requerido', async () => {
    mockRequireAuth.mockResolvedValue(makeClaimsFor(['cliente']))

    const { requireRole } = await import('./requireRole')

    try {
      await requireRole('admin')
      expect.fail('Debe lanzar error')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      const appErr = err as AppError
      expect(appErr.code).toBe('INSUFFICIENT_ROLE')
      expect(appErr.status).toBe(403)
      expect(appErr.retryable).toBe(false)
      expect(appErr.message).toContain('admin')
    }
  })

  it('retorna claims cuando el usuario tiene multiples roles y uno coincide', async () => {
    const claims = makeClaimsFor(['cliente', 'agente', 'director'])
    mockRequireAuth.mockResolvedValue(claims)

    const { requireRole } = await import('./requireRole')
    const result = await requireRole('director')

    expect(result).toEqual(claims)
  })

  it('lanza INSUFFICIENT_ROLE cuando tiene multiples roles pero ninguno coincide', async () => {
    mockRequireAuth.mockResolvedValue(makeClaimsFor(['cliente', 'agente']))

    const { requireRole } = await import('./requireRole')

    try {
      await requireRole('superadmin')
      expect.fail('Debe lanzar error')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      const appErr = err as AppError
      expect(appErr.code).toBe('INSUFFICIENT_ROLE')
      expect(appErr.status).toBe(403)
    }
  })

  it('propaga AUTH_REQUIRED de requireAuth cuando no hay cookie', async () => {
    const authErr = new AppError('AUTH_REQUIRED', 'Sesion requerida', 401, false)
    mockRequireAuth.mockRejectedValue(authErr)

    const { requireRole } = await import('./requireRole')

    try {
      await requireRole('admin')
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

    const { requireRole } = await import('./requireRole')

    try {
      await requireRole('agente')
      expect.fail('Debe lanzar error')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      const appErr = err as AppError
      expect(appErr.code).toBe('AUTH_SESSION_EXPIRED')
      expect(appErr.status).toBe(401)
    }
  })
})
