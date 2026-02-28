import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// === Hoisted mocks ===

const {
  mockRequireAuth,
  mockGet,
  mockDoc,
  mockCollection,
  mockAdd,
} = vi.hoisted(() => {
  const mockRequireAuth = vi.fn()
  const mockGet = vi.fn()
  const mockDoc = vi.fn()
  const mockCollection = vi.fn()
  const mockAdd = vi.fn()
  return { mockRequireAuth, mockGet, mockDoc, mockCollection, mockAdd }
})

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: mockRequireAuth,
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

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/orders', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function setupFirestoreMocks(options: {
  tripExists?: boolean
  tripPublished?: boolean
  depExists?: boolean
  depActive?: boolean
  seatsAvailable?: number
  odooListPriceCentavos?: number
}) {
  const {
    tripExists = true,
    tripPublished = true,
    depExists = true,
    depActive = true,
    seatsAvailable = 10,
    odooListPriceCentavos = 14500000,
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

  // Top-level collection routing
  mockCollection.mockImplementation((name: string) => {
    if (name === 'trips') return { doc: mockTripDoc }
    if (name === 'orders') return { add: mockAdd }
    return {}
  })

  mockAdd.mockResolvedValue({ id: 'order-new-1' })
}

// === Tests ===

describe('POST /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(MOCK_CLAIMS)
    setupFirestoreMocks({})
  })

  it('creates order and returns 201 with correct data', async () => {
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

  it('returns 401 when not authenticated', async () => {
    const authError = new Error('No autenticado')
    Object.assign(authError, { code: 'AUTH_REQUIRED', status: 401, retryable: false, name: 'AppError' })
    mockRequireAuth.mockRejectedValue(authError)

    const req = makeRequest(VALID_BODY)
    const res = await POST(req)

    expect(res.status).toBe(401)
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

  it('returns 400 for short contactPhone', async () => {
    const req = makeRequest({ ...VALID_BODY, contactPhone: '+521' })
    const res = await POST(req)

    expect(res.status).toBe(400)
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
})
