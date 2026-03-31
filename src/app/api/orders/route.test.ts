import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// === Hoisted mocks ===

const {
  mockTryAuth,
  mockGet,
  mockDoc,
  mockCollection,
  mockAdd,
  mockWhere,
} = vi.hoisted(() => {
  const mockTryAuth = vi.fn()
  const mockGet = vi.fn()
  const mockDoc = vi.fn()
  const mockCollection = vi.fn()
  const mockAdd = vi.fn()
  const mockWhere = vi.fn()
  return { mockTryAuth, mockGet, mockDoc, mockCollection, mockAdd, mockWhere }
})

vi.mock('@/lib/auth/tryAuth', () => ({
  tryAuth: mockTryAuth,
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: mockCollection,
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => ({})),
  },
}))

vi.mock('@/lib/errors/AppError', () => ({
  AppError: class AppError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 500,
      public retryable: boolean = false
    ) {
      super(message)
      this.name = 'AppError'
    }
  },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: vi.fn((error: unknown) => {
    if (error instanceof Error && 'status' in error) {
      const e = error as unknown as { code: string; message: string; status: number; retryable: boolean }
      return Response.json(
        { code: e.code, message: e.message, retryable: e.retryable },
        { status: e.status }
      )
    }
    return Response.json(
      { code: 'INTERNAL_ERROR', message: 'Error interno', retryable: true },
      { status: 500 }
    )
  }),
}))

import { POST } from './route'

// === Helpers ===

const MOCK_CLAIMS = { uid: 'user-123', roles: ['cliente'] }

const VALID_BODY = {
  tripId: 'trip-1',
  departureId: 'dep-1',
  contactName: 'Juan Perez',
  contactPhone: '+523411234567',
}

function makeRequest(body: Record<string, unknown>, ip?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ip) headers['x-forwarded-for'] = ip
  return new NextRequest('http://localhost/api/orders', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

function setupFirestoreMocks(options: {
  tripExists?: boolean
  tripPublished?: boolean
  depExists?: boolean
  depActive?: boolean
  seatsAvailable?: number
  odooListPriceCentavos?: number
  agentUser?: { exists: boolean; isActive?: boolean; roles?: string[] } | null
}) {
  const {
    tripExists = true,
    tripPublished = true,
    depExists = true,
    depActive = true,
    seatsAvailable = 10,
    odooListPriceCentavos = 14500000,
    agentUser = null,
  } = options

  const mockDepGet = vi.fn().mockResolvedValue({
    exists: depExists,
    data: () => (depExists ? { isActive: depActive, seatsAvailable } : undefined),
  })
  const mockDepDoc = vi.fn().mockReturnValue({ get: mockDepGet })
  const mockTripCollection = vi.fn().mockReturnValue({ doc: mockDepDoc })

  const mockTripGet = vi.fn().mockResolvedValue({
    exists: tripExists,
    data: () => (tripExists ? { isPublished: tripPublished, odooListPriceCentavos } : undefined),
  })
  const mockTripDoc = vi.fn().mockReturnValue({
    get: mockTripGet,
    collection: mockTripCollection,
  })

  // Agent user lookup mock
  const mockAgentGet = vi.fn().mockResolvedValue(
    agentUser
      ? {
          exists: agentUser.exists,
          data: () =>
            agentUser.exists
              ? { isActive: agentUser.isActive ?? true, roles: agentUser.roles ?? ['agente'] }
              : undefined,
        }
      : { exists: false, data: () => undefined }
  )
  const mockUserDoc = vi.fn().mockReturnValue({ get: mockAgentGet })

  // Rate limit query mock (for guest orders) — uses .count().get()
  const mockCountGet = vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) })
  const mockCount = vi.fn().mockReturnValue({ get: mockCountGet })
  const mockRateLimitWhere3 = vi.fn().mockReturnValue({ count: mockCount })
  const mockRateLimitWhere2 = vi.fn().mockReturnValue({ where: mockRateLimitWhere3 })
  const mockRateLimitWhere1 = vi.fn().mockReturnValue({ where: mockRateLimitWhere2 })

  // Top-level collection routing
  mockCollection.mockImplementation((name: string) => {
    if (name === 'trips') return { doc: mockTripDoc }
    if (name === 'users') return { doc: mockUserDoc }
    if (name === 'orders') return { add: mockAdd, where: mockRateLimitWhere1 }
    return {}
  })

  mockAdd.mockResolvedValue({ id: 'order-new-1' })

  return { mockCountGet, mockAgentGet }
}

// === Tests ===

describe('POST /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTryAuth.mockResolvedValue(MOCK_CLAIMS)
    setupFirestoreMocks({})
  })

  it('creates order and returns 201 with correct data (authenticated)', async () => {
    const req = makeRequest(VALID_BODY)
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data).toEqual({
      orderId: 'order-new-1',
      status: 'Interesado',
      tripId: 'trip-1',
      departureId: 'dep-1',
      amountTotalCents: 14500000,
      guestToken: null,
    })
  })

  it('saves contact data in order document', async () => {
    const req = makeRequest(VALID_BODY)
    await POST(req)

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        contactName: 'Juan Perez',
        contactPhone: '+523411234567',
      })
    )
  })

  it('saves attribution data in order document', async () => {
    setupFirestoreMocks({ agentUser: { exists: true, isActive: true, roles: ['agente'] } })
    const req = makeRequest({
      ...VALID_BODY,
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'summer',
      agentId: 'agent-007',
    })
    await POST(req)

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'summer',
        agentId: 'agent-007',
      })
    )
  })

  it('sets null for missing attribution fields', async () => {
    const req = makeRequest(VALID_BODY)
    await POST(req)

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        agentId: null,
      })
    )
  })

  it('reads price server-side from trip document', async () => {
    setupFirestoreMocks({ odooListPriceCentavos: 9900000 })
    const req = makeRequest(VALID_BODY)
    await POST(req)

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        amountTotalCents: 9900000,
        amountPaidCents: 0,
      })
    )
  })

  it('returns 400 for invalid body (missing required fields)', async () => {
    const req = makeRequest({ tripId: 'trip-1', departureId: 'dep-1' })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for empty tripId', async () => {
    const req = makeRequest({ ...VALID_BODY, tripId: '' })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 for short contactName', async () => {
    const req = makeRequest({ ...VALID_BODY, contactName: 'A' })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('accepts order without contactPhone (optional field)', async () => {
    setupFirestoreMocks({})
    const { contactPhone: _, ...withoutPhone } = VALID_BODY
    const req = makeRequest(withoutPhone)
    const res = await POST(req)

    expect(res.status).toBe(201)
  })

  it('returns 500 when trip has no price configured', async () => {
    setupFirestoreMocks({ odooListPriceCentavos: 0 })
    const req = makeRequest(VALID_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.code).toBe('INVALID_PRICE')
  })

  it('returns 404 when trip not found', async () => {
    setupFirestoreMocks({ tripExists: false })
    const req = makeRequest({ ...VALID_BODY, tripId: 'trip-gone' })
    const res = await POST(req)

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.code).toBe('TRIP_NOT_FOUND')
  })

  it('returns 404 when trip is not published', async () => {
    setupFirestoreMocks({ tripPublished: false })
    const req = makeRequest({ ...VALID_BODY, tripId: 'trip-draft' })
    const res = await POST(req)

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.code).toBe('TRIP_NOT_FOUND')
  })

  it('returns 404 when departure not found', async () => {
    setupFirestoreMocks({ depExists: false })
    const req = makeRequest({ ...VALID_BODY, departureId: 'dep-gone' })
    const res = await POST(req)

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.code).toBe('DEPARTURE_NOT_FOUND')
  })

  it('returns 404 when departure is not active', async () => {
    setupFirestoreMocks({ depActive: false })
    const req = makeRequest({ ...VALID_BODY, departureId: 'dep-inactive' })
    const res = await POST(req)

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.code).toBe('DEPARTURE_NOT_FOUND')
  })

  it('returns 409 when departure is sold out', async () => {
    setupFirestoreMocks({ seatsAvailable: 0 })
    const req = makeRequest({ ...VALID_BODY, departureId: 'dep-full' })
    const res = await POST(req)

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.code).toBe('DEPARTURE_SOLD_OUT')
  })

  it('sets userId from auth claims', async () => {
    const req = makeRequest(VALID_BODY)
    await POST(req)

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123' })
    )
  })

  it('sets order status to Interesado', async () => {
    const req = makeRequest(VALID_BODY)
    await POST(req)

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Interesado' })
    )
  })

  // --- Guest checkout tests ---

  it('creates guest order with userId null and guestToken when not authenticated', async () => {
    mockTryAuth.mockResolvedValue(null)
    setupFirestoreMocks({})

    const req = makeRequest(VALID_BODY, '192.168.1.1')
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.guestToken).toBeTruthy()
    expect(typeof data.guestToken).toBe('string')
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        guestToken: expect.any(String),
        guestIp: '192.168.1.1',
      })
    )
  })

  it('sets guestToken null and guestIp null for authenticated users', async () => {
    const req = makeRequest(VALID_BODY)
    await POST(req)

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        guestToken: null,
        guestIp: null,
      })
    )
  })

  it('returns guestToken null for authenticated orders', async () => {
    const req = makeRequest(VALID_BODY)
    const res = await POST(req)
    const data = await res.json()

    expect(data.guestToken).toBeNull()
  })

  it('returns 429 when guest exceeds rate limit', async () => {
    mockTryAuth.mockResolvedValue(null)
    const { mockCountGet } = setupFirestoreMocks({})
    mockCountGet.mockResolvedValue({ data: () => ({ count: 5 }) })

    const req = makeRequest(VALID_BODY, '10.0.0.1')
    const res = await POST(req)

    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.code).toBe('RATE_LIMITED')
  })

  it('does not apply rate limit for authenticated users', async () => {
    // Authenticated user — should NOT check rate limit
    const req = makeRequest(VALID_BODY)
    const res = await POST(req)

    expect(res.status).toBe(201)
  })

  // --- agentId server-side validation tests ---

  it('stores valid agentId when agent exists, is active, and has agente role', async () => {
    setupFirestoreMocks({ agentUser: { exists: true, isActive: true, roles: ['agente'] } })
    const req = makeRequest({ ...VALID_BODY, agentId: 'agent-lupita' })
    await POST(req)

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'agent-lupita' })
    )
  })

  it('silently sets agentId to null when agent user does not exist', async () => {
    setupFirestoreMocks({ agentUser: { exists: false } })
    const req = makeRequest({ ...VALID_BODY, agentId: 'agent-fake' })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: null })
    )
    expect(data.orderId).toBeDefined()
  })

  it('silently sets agentId to null when agent is inactive', async () => {
    setupFirestoreMocks({ agentUser: { exists: true, isActive: false, roles: ['agente'] } })
    const req = makeRequest({ ...VALID_BODY, agentId: 'agent-inactive' })
    await POST(req)

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: null })
    )
  })

  it('silently sets agentId to null when user exists but lacks agente role', async () => {
    setupFirestoreMocks({ agentUser: { exists: true, isActive: true, roles: ['cliente'] } })
    const req = makeRequest({ ...VALID_BODY, agentId: 'user-not-agent' })
    await POST(req)

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: null })
    )
  })

  it('does not validate agentId when not provided (remains null)', async () => {
    setupFirestoreMocks({})
    const req = makeRequest(VALID_BODY)
    await POST(req)

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: null })
    )
  })
})
