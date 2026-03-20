import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// === Hoisted mocks ===

const { mockRequirePermission, mockDoc, mockCollection, mockAdd, mockRecalculate } = vi.hoisted(() => {
  const mockRequirePermission = vi.fn()
  const mockDoc = vi.fn()
  const mockCollection = vi.fn()
  const mockAdd = vi.fn()
  const mockRecalculate = vi.fn()
  return { mockRequirePermission, mockDoc, mockCollection, mockAdd, mockRecalculate }
})

vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: mockRequirePermission,
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: mockCollection,
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => ({ _sentinel: 'serverTimestamp' })),
    arrayUnion: vi.fn((...args: unknown[]) => ({ _arrayUnion: args })),
    arrayRemove: vi.fn((...args: unknown[]) => ({ _arrayRemove: args })),
  },
  Timestamp: {
    fromDate: vi.fn((d: Date) => ({ _seconds: Math.floor(d.getTime() / 1000) })),
    now: vi.fn(() => ({ _seconds: Math.floor(Date.now() / 1000) })),
  },
}))

vi.mock('@/lib/firebase/departure-aggregates', () => ({
  recalculateTripAggregates: mockRecalculate,
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

const MOCK_CLAIMS = { uid: 'admin-uid', roles: ['admin'] }

function makeParams(tripId: string) {
  return { params: Promise.resolve({ tripId }) }
}

function makeRequest(tripId: string, body: unknown) {
  return new NextRequest(`http://localhost/api/trips/${tripId}/departures`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function setupFirestoreMock(opts: { tripExists: boolean }) {
  const tripSnap = {
    exists: opts.tripExists,
    id: 'trip-1',
    data: () => ({}),
  }

  const depCollectionRef = {
    add: mockAdd,
  }

  const tripDocRef = {
    get: vi.fn().mockResolvedValue(tripSnap),
    collection: vi.fn().mockReturnValue(depCollectionRef),
  }

  mockDoc.mockReturnValue(tripDocRef)
  mockCollection.mockReturnValue({ doc: mockDoc })
}

const VALID_DEPARTURE = {
  name: 'Salida Marzo 2026',
  startDate: '2026-03-15T00:00:00.000Z',
  endDate: '2026-04-17T00:00:00.000Z',
  seatsMax: 20,
}

// === Tests ===

describe('POST /api/trips/[tripId]/departures', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockDoc.mockReset()
    mockCollection.mockReset()
    mockAdd.mockReset()
    mockRecalculate.mockReset()

    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)
    mockAdd.mockResolvedValue({ id: 'dep-new-1' })
    mockRecalculate.mockResolvedValue(undefined)
  })

  it('creates manual departure successfully', async () => {
    setupFirestoreMock({ tripExists: true })

    const request = makeRequest('trip-1', VALID_DEPARTURE)
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.id).toBe('dep-new-1')
    expect(data.name).toBe('Salida Marzo 2026')
    expect(data.startDate).toBe('2026-03-15T00:00:00.000Z')
    expect(data.endDate).toBe('2026-04-17T00:00:00.000Z')
    expect(data.seatsMax).toBe(20)
    expect(data.syncSource).toBe('manual')
    expect(data.createdAt).toBeDefined()
    expect(mockRequirePermission).toHaveBeenCalledWith('trips:write')
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        odooEventId: null,
        odooName: 'Salida Marzo 2026',
        seatsMax: 20,
        seatsAvailable: 20,
        seatsUsed: 0,
        seatsReserved: 0,
        seatsTaken: 0,
        isActive: true,
        isPublished: false,
        syncSource: 'manual',
      })
    )
  })

  it('returns 400 when endDate is before startDate', async () => {
    setupFirestoreMock({ tripExists: true })

    const invalidDeparture = {
      name: 'Salida Invalida',
      startDate: '2026-04-17T00:00:00.000Z',
      endDate: '2026-03-15T00:00:00.000Z',
      seatsMax: 20,
    }

    const request = makeRequest('trip-1', invalidDeparture)
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('returns 400 for missing required fields', async () => {
    setupFirestoreMock({ tripExists: true })

    const request = makeRequest('trip-1', { name: 'Solo nombre' })
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid date format', async () => {
    setupFirestoreMock({ tripExists: true })

    const invalidDeparture = {
      name: 'Salida Invalida',
      startDate: 'not-a-date',
      endDate: '2026-04-17T00:00:00.000Z',
      seatsMax: 20,
    }

    const request = makeRequest('trip-1', invalidDeparture)
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for seatsMax of 0', async () => {
    setupFirestoreMock({ tripExists: true })

    const invalidDeparture = {
      ...VALID_DEPARTURE,
      seatsMax: 0,
    }

    const request = makeRequest('trip-1', invalidDeparture)
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for seatsMax exceeding 1000', async () => {
    setupFirestoreMock({ tripExists: true })

    const invalidDeparture = {
      ...VALID_DEPARTURE,
      seatsMax: 1001,
    }

    const request = makeRequest('trip-1', invalidDeparture)
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for non-existent trip', async () => {
    setupFirestoreMock({ tripExists: false })

    const request = makeRequest('nonexistent', VALID_DEPARTURE)
    const response = await POST(request, makeParams('nonexistent'))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('TRIP_NOT_FOUND')
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('returns 403 when auth is denied', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso trips:edit requerido', 403, false)
    )

    const request = makeRequest('trip-1', VALID_DEPARTURE)
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('INSUFFICIENT_PERMISSION')
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('sets seatsAvailable equal to seatsMax on creation', async () => {
    setupFirestoreMock({ tripExists: true })

    const request = makeRequest('trip-1', { ...VALID_DEPARTURE, seatsMax: 50 })
    await POST(request, makeParams('trip-1'))

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        seatsMax: 50,
        seatsAvailable: 50,
      })
    )
  })

  it('defaults isPublished to false when not provided', async () => {
    setupFirestoreMock({ tripExists: true })

    const request = makeRequest('trip-1', VALID_DEPARTURE)
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.isPublished).toBe(false)
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ isPublished: false })
    )
  })

  it('accepts isPublished true and persists it', async () => {
    setupFirestoreMock({ tripExists: true })

    const request = makeRequest('trip-1', { ...VALID_DEPARTURE, isPublished: true })
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.isPublished).toBe(true)
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ isPublished: true })
    )
  })

  it('calls recalculateTripAggregates after creation', async () => {
    setupFirestoreMock({ tripExists: true })

    const request = makeRequest('trip-1', VALID_DEPARTURE)
    await POST(request, makeParams('trip-1'))

    expect(mockRecalculate).toHaveBeenCalledWith('trip-1')
  })
})
