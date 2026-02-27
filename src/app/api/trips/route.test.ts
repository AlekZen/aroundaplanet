import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// === Hoisted mocks ===

const { mockRequirePermission, mockGet, mockDoc, mockCollection, mockWhere, mockOrderBy, mockLimit } = vi.hoisted(() => {
  const mockRequirePermission = vi.fn()
  const mockGet = vi.fn()
  const mockDoc = vi.fn()
  const mockCollection = vi.fn()
  const mockWhere = vi.fn()
  const mockOrderBy = vi.fn()
  const mockLimit = vi.fn()
  return { mockRequirePermission, mockGet, mockDoc, mockCollection, mockWhere, mockOrderBy, mockLimit }
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
    serverTimestamp: vi.fn(() => ({})),
    arrayUnion: vi.fn((...args: unknown[]) => ({ _arrayUnion: args })),
    arrayRemove: vi.fn((...args: unknown[]) => ({ _arrayRemove: args })),
  },
  Timestamp: {
    fromDate: vi.fn((d: Date) => ({ _seconds: Math.floor(d.getTime() / 1000) })),
    now: vi.fn(() => ({ _seconds: Math.floor(Date.now() / 1000) })),
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

import { GET } from './route'

// === Helpers ===

const MOCK_CLAIMS = { uid: 'admin-uid', roles: ['admin'] }

function makeTrip(id: string, name: string, isPublished = true) {
  return {
    id,
    data: () => ({ odooName: name, isPublished }),
  }
}

function setupChainableMock(docs: ReturnType<typeof makeTrip>[] = []) {
  const snapshot = { docs, empty: docs.length === 0 }
  mockGet.mockResolvedValue(snapshot)
  mockWhere.mockReturnThis()
  mockOrderBy.mockReturnThis()
  mockLimit.mockReturnThis()

  // For with-departures subcollection checks
  const depRef = {
    where: mockWhere,
    limit: mockLimit,
    get: vi.fn().mockResolvedValue({ empty: false }),
  }

  const docRef = {
    collection: vi.fn().mockReturnValue(depRef),
  }

  mockDoc.mockReturnValue(docRef)

  const queryRef = {
    orderBy: mockOrderBy,
    where: mockWhere,
    get: mockGet,
    doc: mockDoc,
  }

  mockCollection.mockReturnValue(queryRef)
}

// === Tests ===

describe('GET /api/trips', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockGet.mockReset()
    mockDoc.mockReset()
    mockCollection.mockReset()
    mockWhere.mockReset()
    mockOrderBy.mockReset()
    mockLimit.mockReset()

    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)
  })

  it('returns paginated trip list', async () => {
    const trips = [
      makeTrip('trip-1', 'Vuelta al Mundo 2026'),
      makeTrip('trip-2', 'Europa Express 2026'),
      makeTrip('trip-3', 'Asia Discovery 2026'),
    ]
    setupChainableMock(trips)

    const request = new NextRequest('http://localhost/api/trips')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.trips).toHaveLength(3)
    expect(data.total).toBe(3)
    expect(data.nextCursor).toBeNull()
    expect(mockRequirePermission).toHaveBeenCalledWith('trips:read')
  })

  it('applies search filter in memory', async () => {
    const trips = [
      makeTrip('trip-1', 'Vuelta al Mundo 2026'),
      makeTrip('trip-2', 'Europa Express 2026'),
      makeTrip('trip-3', 'Asia Discovery 2026'),
    ]
    setupChainableMock(trips)

    const request = new NextRequest('http://localhost/api/trips?search=vuelta')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.trips).toHaveLength(1)
    expect(data.trips[0].odooName).toBe('Vuelta al Mundo 2026')
    expect(data.total).toBe(1)
  })

  it('applies published filter via Firestore where clause', async () => {
    const trips = [makeTrip('trip-1', 'Vuelta al Mundo 2026', true)]
    setupChainableMock(trips)

    const request = new NextRequest('http://localhost/api/trips?filter=published')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(mockWhere).toHaveBeenCalledWith('isPublished', '==', true)
  })

  it('applies draft filter via Firestore where clause', async () => {
    const trips = [makeTrip('trip-2', 'Europa Express 2026', false)]
    setupChainableMock(trips)

    const request = new NextRequest('http://localhost/api/trips?filter=draft')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(mockWhere).toHaveBeenCalledWith('isPublished', '==', false)
  })

  it('handles empty results', async () => {
    setupChainableMock([])

    const request = new NextRequest('http://localhost/api/trips?search=nonexistent')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.trips).toHaveLength(0)
    expect(data.total).toBe(0)
    expect(data.nextCursor).toBeNull()
  })

  it('returns cursor for pagination when more results exist', async () => {
    // Create 25 trips, pageSize defaults to 20
    const trips = Array.from({ length: 25 }, (_, i) =>
      makeTrip(`trip-${i}`, `Trip ${i}`)
    )
    setupChainableMock(trips)

    const request = new NextRequest('http://localhost/api/trips')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.trips).toHaveLength(20)
    expect(data.total).toBe(25)
    expect(data.nextCursor).toBe('trip-19')
  })

  it('returns validation error for invalid pageSize', async () => {
    const request = new NextRequest('http://localhost/api/trips?pageSize=0')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
    expect(data.retryable).toBe(false)
  })

  it('returns validation error for invalid filter value', async () => {
    const request = new NextRequest('http://localhost/api/trips?filter=invalid')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for invalid cursor', async () => {
    const trips = [makeTrip('trip-1', 'Vuelta')]
    setupChainableMock(trips)

    const request = new NextRequest('http://localhost/api/trips?cursor=nonexistent-id')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('INVALID_CURSOR')
  })

  it('returns 403 when auth is denied', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso trips:read requerido', 403, false)
    )

    const request = new NextRequest('http://localhost/api/trips')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('INSUFFICIENT_PERMISSION')
    expect(data.retryable).toBe(false)
  })

  it('returns 401 when not authenticated', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('AUTH_REQUIRED', 'Autenticacion requerida', 401, false)
    )

    const request = new NextRequest('http://localhost/api/trips')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.code).toBe('AUTH_REQUIRED')
  })
})
