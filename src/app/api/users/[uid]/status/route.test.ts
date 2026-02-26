import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// vi.hoisted for all mock variables used in vi.mock() factories
const mockRequirePermission = vi.hoisted(() => vi.fn())
const mockRevokeRefreshTokens = vi.hoisted(() => vi.fn())
const mockUserDocGet = vi.hoisted(() => vi.fn())
const mockUserDocUpdate = vi.hoisted(() => vi.fn())
const mockAuditAdd = vi.hoisted(() => vi.fn())
const mockTimestampNow = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: mockRequirePermission,
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: {
    revokeRefreshTokens: mockRevokeRefreshTokens,
  },
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
      if (name === 'auditLog') {
        return {
          add: mockAuditAdd,
        }
      }
      return {}
    }),
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    now: mockTimestampNow,
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
  return new NextRequest('http://localhost/api/users/target-uid/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(uid: string) {
  return { params: Promise.resolve({ uid }) }
}

describe('PATCH /api/users/[uid]/status', () => {
  const FAKE_TIMESTAMP = { seconds: 1234567890, nanoseconds: 0 }

  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockRevokeRefreshTokens.mockReset()
    mockUserDocGet.mockReset()
    mockUserDocUpdate.mockReset()
    mockAuditAdd.mockReset()
    mockTimestampNow.mockReset()

    // Default: caller is superadmin with uid 'admin1'
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['superadmin'] })
    // Default: user exists and is active
    mockUserDocGet.mockResolvedValue({ exists: true, data: () => ({ isActive: true }) })
    mockUserDocUpdate.mockResolvedValue(undefined)
    mockRevokeRefreshTokens.mockResolvedValue(undefined)
    mockAuditAdd.mockResolvedValue({ id: 'audit1' })
    mockTimestampNow.mockReturnValue(FAKE_TIMESTAMP)
  })

  it('calls requirePermission with users:manage', async () => {
    const { PATCH } = await import('./route')
    await PATCH(makeRequest({ isActive: false }), makeParams('target-uid'))

    expect(mockRequirePermission).toHaveBeenCalledWith('users:manage')
  })

  it('returns 403 when caller lacks users:manage permission', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso users:manage requerido', 403, false)
    )

    const { PATCH } = await import('./route')
    const response = await PATCH(makeRequest({ isActive: false }), makeParams('target-uid'))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.code).toBe('INSUFFICIENT_PERMISSION')
  })

  it('deactivates user, revokes tokens, and writes audit log', async () => {
    const { PATCH } = await import('./route')
    const response = await PATCH(
      makeRequest({ isActive: false, reason: 'Inactividad prolongada' }),
      makeParams('target-uid')
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.isActive).toBe(false)

    // Firestore update
    expect(mockUserDocUpdate).toHaveBeenCalledWith({ isActive: false })

    // Token revocation
    expect(mockRevokeRefreshTokens).toHaveBeenCalledWith('target-uid')

    // Audit log
    expect(mockAuditAdd).toHaveBeenCalledWith({
      action: 'user.deactivated',
      targetUid: 'target-uid',
      performedBy: 'admin1',
      timestamp: FAKE_TIMESTAMP,
      details: {
        reason: 'Inactividad prolongada',
        previousStatus: true,
        newStatus: false,
      },
    })
  })

  it('activates user without revoking tokens and writes audit log', async () => {
    // User is currently inactive
    mockUserDocGet.mockResolvedValue({ exists: true, data: () => ({ isActive: false }) })

    const { PATCH } = await import('./route')
    const response = await PATCH(makeRequest({ isActive: true }), makeParams('target-uid'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.isActive).toBe(true)

    // Firestore update
    expect(mockUserDocUpdate).toHaveBeenCalledWith({ isActive: true })

    // NO token revocation on activation
    expect(mockRevokeRefreshTokens).not.toHaveBeenCalled()

    // Audit log
    expect(mockAuditAdd).toHaveBeenCalledWith({
      action: 'user.activated',
      targetUid: 'target-uid',
      performedBy: 'admin1',
      timestamp: FAKE_TIMESTAMP,
      details: {
        previousStatus: false,
        newStatus: true,
      },
    })
  })

  it('returns 400 when trying to self-deactivate', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'self-uid', roles: ['superadmin'] })

    const { PATCH } = await import('./route')
    const response = await PATCH(makeRequest({ isActive: false }), makeParams('self-uid'))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe('USER_SELF_DEACTIVATION')
  })

  it('allows self-activation (only self-deactivation is blocked)', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'self-uid', roles: ['superadmin'] })
    mockUserDocGet.mockResolvedValue({ exists: true, data: () => ({ isActive: false }) })

    const { PATCH } = await import('./route')
    const response = await PATCH(makeRequest({ isActive: true }), makeParams('self-uid'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.isActive).toBe(true)
  })

  it('returns 400 for invalid request body — missing isActive', async () => {
    const { PATCH } = await import('./route')
    const response = await PATCH(makeRequest({}), makeParams('target-uid'))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for invalid request body — isActive not boolean', async () => {
    const { PATCH } = await import('./route')
    const response = await PATCH(makeRequest({ isActive: 'yes' }), makeParams('target-uid'))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 when user does not exist', async () => {
    mockUserDocGet.mockResolvedValue({ exists: false })

    const { PATCH } = await import('./route')
    const response = await PATCH(makeRequest({ isActive: false }), makeParams('nonexistent'))

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.code).toBe('USER_NOT_FOUND')
  })

  it('writes audit log without reason when not provided', async () => {
    const { PATCH } = await import('./route')
    await PATCH(makeRequest({ isActive: false }), makeParams('target-uid'))

    expect(mockAuditAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.not.objectContaining({ reason: expect.anything() }),
      })
    )
    // Verify other fields are present
    expect(mockAuditAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          previousStatus: true,
          newStatus: false,
        }),
      })
    )
  })

  it('handles previousStatus as null when field is missing from user doc', async () => {
    mockUserDocGet.mockResolvedValue({ exists: true, data: () => ({}) })

    const { PATCH } = await import('./route')
    await PATCH(makeRequest({ isActive: true }), makeParams('target-uid'))

    expect(mockAuditAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          previousStatus: null,
          newStatus: true,
        }),
      })
    )
  })
})
