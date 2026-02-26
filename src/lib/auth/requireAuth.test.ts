import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors/AppError'

const mockVerifySessionCookie = vi.fn()
const mockCookieGet = vi.fn()
const mockCookies = vi.fn()

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: {
    verifySessionCookie: mockVerifySessionCookie,
  },
}))

describe('requireAuth', () => {
  beforeEach(() => {
    mockVerifySessionCookie.mockReset()
    mockCookieGet.mockReset()
    mockCookies.mockReset()
    mockCookies.mockResolvedValue({ get: mockCookieGet })
  })

  it('lanza AUTH_REQUIRED con status 401 cuando no hay cookie de sesion', async () => {
    mockCookieGet.mockReturnValue(undefined)

    const { requireAuth } = await import('./requireAuth')

    try {
      await requireAuth()
      expect.fail('Debe lanzar error')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      const appErr = err as AppError
      expect(appErr.code).toBe('AUTH_REQUIRED')
      expect(appErr.status).toBe(401)
      expect(appErr.retryable).toBe(false)
    }
  })

  it('retorna uid, roles y agentId cuando la cookie es valida con roles', async () => {
    mockCookieGet.mockReturnValue({ value: 'valid-session-token' })
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'user-abc',
      roles: ['cliente', 'agente'],
      agentId: 'agent-123',
    })

    const { requireAuth } = await import('./requireAuth')
    const result = await requireAuth()

    expect(mockVerifySessionCookie).toHaveBeenCalledWith('valid-session-token', true)
    expect(result).toEqual({
      uid: 'user-abc',
      roles: ['cliente', 'agente'],
      agentId: 'agent-123',
    })
  })

  it('usa ["cliente"] por defecto cuando roles no es un array', async () => {
    mockCookieGet.mockReturnValue({ value: 'session-sin-roles' })
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'user-xyz',
      roles: undefined,
    })

    const { requireAuth } = await import('./requireAuth')
    const result = await requireAuth()

    expect(result.roles).toEqual(['cliente'])
    expect(result.uid).toBe('user-xyz')
  })

  it('incluye agentId en el resultado cuando esta presente en el token', async () => {
    mockCookieGet.mockReturnValue({ value: 'session-with-agent' })
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'user-agente',
      roles: ['cliente', 'agente'],
      agentId: 'agent-456',
    })

    const { requireAuth } = await import('./requireAuth')
    const result = await requireAuth()

    expect(result.agentId).toBe('agent-456')
  })

  it('retorna agentId como undefined cuando no esta en el token', async () => {
    mockCookieGet.mockReturnValue({ value: 'session-no-agent' })
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'user-sin-agent',
      roles: ['cliente'],
    })

    const { requireAuth } = await import('./requireAuth')
    const result = await requireAuth()

    expect(result.agentId).toBeUndefined()
  })

  it('lanza AUTH_SESSION_EXPIRED con status 401 cuando la cookie esta expirada o revocada', async () => {
    mockCookieGet.mockReturnValue({ value: 'expired-session-token' })
    mockVerifySessionCookie.mockRejectedValue(new Error('Session cookie expired'))

    const { requireAuth } = await import('./requireAuth')

    try {
      await requireAuth()
      expect.fail('Debe lanzar error')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      const appErr = err as AppError
      expect(appErr.code).toBe('AUTH_SESSION_EXPIRED')
      expect(appErr.status).toBe(401)
      expect(appErr.retryable).toBe(false)
    }
  })
})
