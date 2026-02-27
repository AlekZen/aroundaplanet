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
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockUserDocGet,
        update: mockUserDocUpdate,
      })),
    })),
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

const FAKE_TIMESTAMP = { _seconds: 1234567890, _nanoseconds: 0 }

function makeGetRequest(uid: string): NextRequest {
  return new NextRequest(`http://localhost/api/users/${uid}/preferences`, {
    method: 'GET',
  })
}

function makePatchRequest(uid: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/users/${uid}/preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(uid: string) {
  return { params: Promise.resolve({ uid }) }
}

describe('GET /api/users/[uid]/preferences', () => {
  beforeEach(() => {
    mockRequireAuth.mockReset()
    mockRequirePermission.mockReset()
    mockUserDocGet.mockReset()
    mockUserDocUpdate.mockReset()
    mockFieldValueServerTimestamp.mockReset()

    mockRequireAuth.mockResolvedValue({ uid: 'user1', roles: ['cliente'] })
    mockFieldValueServerTimestamp.mockReturnValue(FAKE_TIMESTAMP)
  })

  it('returns default preferences when none exist', async () => {
    mockUserDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ roles: ['cliente'] }),
    })

    const { GET } = await import('./route')
    const response = await GET(makeGetRequest('user1'), makeParams('user1'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.preferences).toBeDefined()
    expect(body.preferences.channels).toEqual({ push: true, whatsapp: true, email: false })
    expect(body.preferences.timezone).toBe('America/Mexico_City')
    expect(body.preferences.quietHours).toEqual({
      enabled: true,
      startTime: '23:00',
      endTime: '07:00',
    })
  })

  it('filters categories by user roles — cliente sees payments, trips, alerts', async () => {
    mockUserDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ roles: ['cliente'] }),
    })

    const { GET } = await import('./route')
    const response = await GET(makeGetRequest('user1'), makeParams('user1'))

    const body = await response.json()
    const categoryKeys = Object.keys(body.preferences.categories)
    expect(categoryKeys).toContain('payments')
    expect(categoryKeys).toContain('trips')
    expect(categoryKeys).toContain('alerts')
    expect(categoryKeys).not.toContain('sales')
    expect(categoryKeys).not.toContain('reports')
  })

  it('filters categories by user roles — agente sees payments, sales, reports, alerts', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'agent1', roles: ['agente'] })
    mockUserDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ roles: ['agente'] }),
    })

    const { GET } = await import('./route')
    const response = await GET(makeGetRequest('agent1'), makeParams('agent1'))

    const body = await response.json()
    const categoryKeys = Object.keys(body.preferences.categories)
    expect(categoryKeys).toContain('payments')
    expect(categoryKeys).toContain('sales')
    expect(categoryKeys).toContain('reports')
    expect(categoryKeys).toContain('alerts')
    expect(categoryKeys).not.toContain('trips')
  })

  it('superadmin sees all categories', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'sa1', roles: ['superadmin'] })
    mockUserDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ roles: ['superadmin'] }),
    })

    const { GET } = await import('./route')
    const response = await GET(makeGetRequest('sa1'), makeParams('sa1'))

    const body = await response.json()
    const categoryKeys = Object.keys(body.preferences.categories)
    expect(categoryKeys).toContain('payments')
    expect(categoryKeys).toContain('sales')
    expect(categoryKeys).toContain('reports')
    expect(categoryKeys).toContain('trips')
    expect(categoryKeys).toContain('alerts')
  })

  it('merges existing preferences with defaults', async () => {
    mockUserDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        roles: ['cliente'],
        notificationPreferences: {
          categories: { payments: false },
          timezone: 'Europe/Madrid',
        },
      }),
    })

    const { GET } = await import('./route')
    const response = await GET(makeGetRequest('user1'), makeParams('user1'))

    const body = await response.json()
    expect(body.preferences.categories.payments).toBe(false)
    expect(body.preferences.categories.trips).toBe(true) // default
    expect(body.preferences.timezone).toBe('Europe/Madrid')
  })

  it('allows admin to read another user preferences', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockRequirePermission.mockResolvedValue(undefined)
    mockUserDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ roles: ['cliente'] }),
    })

    const { GET } = await import('./route')
    const response = await GET(makeGetRequest('user1'), makeParams('user1'))

    expect(response.status).toBe(200)
    expect(mockRequirePermission).toHaveBeenCalledWith('users:read')
  })

  it('returns 404 when user not found', async () => {
    mockUserDocGet.mockResolvedValue({ exists: false })

    const { GET } = await import('./route')
    const response = await GET(makeGetRequest('user1'), makeParams('user1'))

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.code).toBe('USER_NOT_FOUND')
  })

  it('returns 401 when not authenticated', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequireAuth.mockRejectedValue(
      new AppError('AUTH_REQUIRED', 'Autenticacion requerida', 401, false)
    )

    const { GET } = await import('./route')
    const response = await GET(makeGetRequest('user1'), makeParams('user1'))

    expect(response.status).toBe(401)
  })
})

describe('PATCH /api/users/[uid]/preferences', () => {
  beforeEach(() => {
    mockRequireAuth.mockReset()
    mockRequirePermission.mockReset()
    mockUserDocGet.mockReset()
    mockUserDocUpdate.mockReset()
    mockFieldValueServerTimestamp.mockReset()

    mockRequireAuth.mockResolvedValue({ uid: 'user1', roles: ['cliente'] })
    mockUserDocUpdate.mockResolvedValue(undefined)
    mockFieldValueServerTimestamp.mockReturnValue(FAKE_TIMESTAMP)
  })

  it('updates notification preferences and returns merged result', async () => {
    mockUserDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ roles: ['cliente'] }),
    })

    const { PATCH } = await import('./route')
    const response = await PATCH(
      makePatchRequest('user1', {
        categories: { payments: false },
        timezone: 'Europe/Madrid',
      }),
      makeParams('user1')
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.preferences).toBeDefined()
    expect(body.preferences.categories.payments).toBe(false)
    expect(body.preferences.timezone).toBe('Europe/Madrid')
  })

  it('filters categories to only allowed for user roles', async () => {
    mockUserDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ roles: ['cliente'] }),
    })

    const { PATCH } = await import('./route')
    await PATCH(
      makePatchRequest('user1', {
        categories: { payments: false, sales: true, reports: true },
      }),
      makeParams('user1')
    )

    // sales and reports should be filtered out for cliente
    const updateArg = mockUserDocUpdate.mock.calls[0][0]
    const savedPrefs = updateArg.notificationPreferences
    expect(savedPrefs.categories.payments).toBe(false)
    expect(savedPrefs.categories).not.toHaveProperty('sales')
    expect(savedPrefs.categories).not.toHaveProperty('reports')
  })

  it('updates quiet hours', async () => {
    mockUserDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ roles: ['cliente'] }),
    })

    const { PATCH } = await import('./route')
    const response = await PATCH(
      makePatchRequest('user1', {
        quietHours: { enabled: true, startTime: '22:00', endTime: '08:00' },
      }),
      makeParams('user1')
    )

    expect(response.status).toBe(200)
    const updateArg = mockUserDocUpdate.mock.calls[0][0]
    expect(updateArg.notificationPreferences.quietHours).toEqual({
      enabled: true,
      startTime: '22:00',
      endTime: '08:00',
    })
  })

  it('updates channels', async () => {
    mockUserDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ roles: ['cliente'] }),
    })

    const { PATCH } = await import('./route')
    await PATCH(
      makePatchRequest('user1', {
        channels: { push: true, whatsapp: false, email: true },
      }),
      makeParams('user1')
    )

    const updateArg = mockUserDocUpdate.mock.calls[0][0]
    expect(updateArg.notificationPreferences.channels).toEqual({
      push: true,
      whatsapp: false,
      email: true,
    })
  })

  it('merges with existing preferences', async () => {
    mockUserDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        roles: ['cliente'],
        notificationPreferences: {
          categories: { payments: true, trips: false },
          timezone: 'Europe/Madrid',
        },
      }),
    })

    const { PATCH } = await import('./route')
    await PATCH(
      makePatchRequest('user1', {
        categories: { payments: false },
      }),
      makeParams('user1')
    )

    const updateArg = mockUserDocUpdate.mock.calls[0][0]
    const prefs = updateArg.notificationPreferences
    // payments updated to false
    expect(prefs.categories.payments).toBe(false)
    // trips preserved from existing
    expect(prefs.categories.trips).toBe(false)
    // timezone preserved from existing
    expect(prefs.timezone).toBe('Europe/Madrid')
  })

  it('includes updatedAt serverTimestamp', async () => {
    mockUserDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ roles: ['cliente'] }),
    })

    const { PATCH } = await import('./route')
    await PATCH(
      makePatchRequest('user1', { timezone: 'UTC' }),
      makeParams('user1')
    )

    expect(mockUserDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: FAKE_TIMESTAMP })
    )
  })

  describe('authorization', () => {
    it('returns 403 when trying to update another user preferences', async () => {
      mockRequireAuth.mockResolvedValue({ uid: 'other-user', roles: ['cliente'] })

      const { PATCH } = await import('./route')
      const response = await PATCH(
        makePatchRequest('user1', { timezone: 'UTC' }),
        makeParams('user1')
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.code).toBe('INSUFFICIENT_PERMISSIONS')
    })

    it('returns 401 when not authenticated', async () => {
      const { AppError } = await import('@/lib/errors/AppError')
      mockRequireAuth.mockRejectedValue(
        new AppError('AUTH_REQUIRED', 'Autenticacion requerida', 401, false)
      )

      const { PATCH } = await import('./route')
      const response = await PATCH(
        makePatchRequest('user1', { timezone: 'UTC' }),
        makeParams('user1')
      )

      expect(response.status).toBe(401)
    })
  })

  describe('validation', () => {
    it('returns 400 for invalid quiet hours time format', async () => {
      const { PATCH } = await import('./route')
      const response = await PATCH(
        makePatchRequest('user1', {
          quietHours: { enabled: true, startTime: '11pm', endTime: '07:00' },
        }),
        makeParams('user1')
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.code).toBe('PREFERENCE_VALIDATION_ERROR')
    })

    it('returns 400 for empty timezone string', async () => {
      const { PATCH } = await import('./route')
      const response = await PATCH(
        makePatchRequest('user1', { timezone: '' }),
        makeParams('user1')
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.code).toBe('PREFERENCE_VALIDATION_ERROR')
    })

    it('accepts empty object (all fields optional)', async () => {
      mockUserDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ roles: ['cliente'] }),
      })

      const { PATCH } = await import('./route')
      const response = await PATCH(
        makePatchRequest('user1', {}),
        makeParams('user1')
      )

      expect(response.status).toBe(200)
    })
  })

  it('returns 404 when user not found', async () => {
    mockUserDocGet.mockResolvedValue({ exists: false })

    const { PATCH } = await import('./route')
    const response = await PATCH(
      makePatchRequest('user1', { timezone: 'UTC' }),
      makeParams('user1')
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.code).toBe('USER_NOT_FOUND')
  })
})
