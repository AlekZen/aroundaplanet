import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVerifySessionCookie = vi.fn()
const mockGetUser = vi.fn()
const mockSetCustomUserClaims = vi.fn()
const mockRevokeRefreshTokens = vi.fn()
const mockDocGet = vi.fn()
const mockDocUpdate = vi.fn()
const mockDoc = vi.fn(() => ({ get: mockDocGet, update: mockDocUpdate }))
const mockCookieGet = vi.fn()
const mockClearPermissionCache = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mockCookieGet,
  })),
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: {
    verifySessionCookie: mockVerifySessionCookie,
    getUser: mockGetUser,
    setCustomUserClaims: mockSetCustomUserClaims,
    revokeRefreshTokens: mockRevokeRefreshTokens,
  },
  adminDb: {
    doc: mockDoc,
    collection: vi.fn(),
  },
}))

vi.mock('@/lib/auth/claims', () => ({
  getUserClaims: vi.fn(async () => ({ roles: ['cliente'] })),
  setUserClaims: vi.fn(async () => undefined),
}))

vi.mock('@/lib/auth/permissions', () => ({
  clearPermissionCache: mockClearPermissionCache,
}))

describe('/api/auth/claims', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCookieGet.mockReset()
    mockVerifySessionCookie.mockReset()
  })

  describe('GET', () => {
    it('returns 401 when no session cookie', async () => {
      mockCookieGet.mockReturnValue(undefined)

      const { GET } = await import('./route')
      const response = await GET()

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.code).toBe('AUTH_REQUIRED')
    })

    it('returns user claims for valid session', async () => {
      mockCookieGet.mockReturnValue({ value: 'valid-session-cookie' })
      mockVerifySessionCookie.mockResolvedValue({ uid: 'user123' })

      const { GET } = await import('./route')
      const response = await GET()

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.roles).toEqual(['cliente'])
    })

    it('returns 401 for invalid session cookie', async () => {
      mockCookieGet.mockReturnValue({ value: 'invalid-cookie' })
      mockVerifySessionCookie.mockRejectedValue(new Error('Invalid session'))

      const { GET } = await import('./route')
      const response = await GET()

      expect(response.status).toBe(401)
    })
  })

  describe('POST', () => {
    it('returns 401 when no session cookie', async () => {
      mockCookieGet.mockReturnValue(undefined)

      const { POST } = await import('./route')
      const response = await POST(
        new Request('http://localhost/api/auth/claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: 'user123', roles: ['cliente'] }),
        })
      )

      expect(response.status).toBe(401)
    })

    it('returns 403 when caller is not superadmin', async () => {
      mockCookieGet.mockReturnValue({ value: 'valid-session' })
      mockVerifySessionCookie.mockResolvedValue({
        uid: 'caller123',
        roles: ['cliente', 'admin'],
      })

      const { POST } = await import('./route')
      const response = await POST(
        new Request('http://localhost/api/auth/claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: 'user123', roles: ['cliente', 'admin'] }),
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.code).toBe('INSUFFICIENT_ROLE')
    })

    it('returns 400 for invalid request body', async () => {
      mockCookieGet.mockReturnValue({ value: 'valid-session' })
      mockVerifySessionCookie.mockResolvedValue({
        uid: 'caller123',
        roles: ['cliente', 'superadmin'],
      })

      const { POST } = await import('./route')
      const response = await POST(
        new Request('http://localhost/api/auth/claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: '', roles: [] }),
        })
      )

      expect(response.status).toBe(400)
    })

    it('returns 204 on successful claims update', async () => {
      mockCookieGet.mockReturnValue({ value: 'valid-session' })
      mockVerifySessionCookie.mockResolvedValue({
        uid: 'caller123',
        roles: ['cliente', 'superadmin'],
      })

      const { POST } = await import('./route')
      const response = await POST(
        new Request('http://localhost/api/auth/claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: 'user123', roles: ['cliente', 'admin'] }),
        })
      )

      expect(response.status).toBe(204)
    })

    it('calls clearPermissionCache after successful claims update', async () => {
      mockCookieGet.mockReturnValue({ value: 'valid-session' })
      mockVerifySessionCookie.mockResolvedValue({
        uid: 'caller123',
        roles: ['cliente', 'superadmin'],
      })

      const { POST } = await import('./route')
      await POST(
        new Request('http://localhost/api/auth/claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: 'user123', roles: ['cliente', 'admin'] }),
        })
      )

      expect(mockClearPermissionCache).toHaveBeenCalledTimes(1)
    })

    it('returns 400 when agentId not found in Firestore', async () => {
      mockCookieGet.mockReturnValue({ value: 'valid-session' })
      mockVerifySessionCookie.mockResolvedValue({
        uid: 'caller123',
        roles: ['cliente', 'superadmin'],
      })
      mockDocGet.mockResolvedValue({ exists: false })

      const { POST } = await import('./route')
      const response = await POST(
        new Request('http://localhost/api/auth/claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: 'user123',
            roles: ['cliente', 'agente'],
            agentId: 'nonexistent',
          }),
        })
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.code).toBe('AGENT_NOT_FOUND')
    })
  })
})
