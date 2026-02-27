import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// === Hoisted mocks ===

const { mockRequirePermission, mockGet, mockDoc, mockCollection, mockUpdate, mockOrderBy } = vi.hoisted(() => {
  const mockRequirePermission = vi.fn()
  const mockGet = vi.fn()
  const mockDoc = vi.fn()
  const mockCollection = vi.fn()
  const mockUpdate = vi.fn()
  const mockOrderBy = vi.fn()
  return { mockRequirePermission, mockGet, mockDoc, mockCollection, mockUpdate, mockOrderBy }
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

import { GET, PATCH } from './route'

// === Helpers ===

const MOCK_CLAIMS = { uid: 'admin-uid', roles: ['admin'] }

function makeParams(tripId: string) {
  return { params: Promise.resolve({ tripId }) }
}

const MOCK_TRIP_DATA = {
  odooName: 'Vuelta al Mundo 2026',
  odooProductId: 42,
  odooListPriceCentavos: 14500000,
  isPublished: true,
  slug: 'vuelta-al-mundo-2026',
  heroImages: [],
  tags: ['aventura'],
}

const MOCK_DEPARTURE_DOC = {
  id: 'dep-1',
  data: () => ({
    odooName: 'Salida Marzo 2026',
    startDate: { _seconds: 1772000000 },
    endDate: { _seconds: 1775000000 },
    seatsMax: 20,
    syncSource: 'manual',
  }),
}

function setupFirestoreMock(opts: { tripExists: boolean; tripData?: Record<string, unknown>; departures?: typeof MOCK_DEPARTURE_DOC[] }) {
  const tripSnap = {
    exists: opts.tripExists,
    id: 'trip-1',
    data: () => opts.tripData ?? MOCK_TRIP_DATA,
  }

  const depSnap = {
    docs: opts.departures ?? [MOCK_DEPARTURE_DOC],
  }

  const depGet = vi.fn().mockResolvedValue(depSnap)
  mockOrderBy.mockReturnValue({ get: depGet })

  const depCollectionRef = {
    orderBy: mockOrderBy,
  }

  const tripDocRef = {
    get: vi.fn().mockResolvedValue(tripSnap),
    update: mockUpdate,
    collection: vi.fn().mockReturnValue(depCollectionRef),
  }

  mockDoc.mockReturnValue(tripDocRef)
  mockCollection.mockReturnValue({ doc: mockDoc })

  return { tripDocRef, tripSnap }
}

// === Tests: GET /api/trips/[tripId] ===

describe('GET /api/trips/[tripId]', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockGet.mockReset()
    mockDoc.mockReset()
    mockCollection.mockReset()
    mockUpdate.mockReset()
    mockOrderBy.mockReset()

    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)
  })

  it('returns trip with departures', async () => {
    setupFirestoreMock({ tripExists: true })

    const request = new NextRequest('http://localhost/api/trips/trip-1')
    const response = await GET(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('trip-1')
    expect(data.odooName).toBe('Vuelta al Mundo 2026')
    expect(data.departures).toHaveLength(1)
    expect(data.departures[0].id).toBe('dep-1')
    expect(data.departures[0].odooName).toBe('Salida Marzo 2026')
    expect(mockRequirePermission).toHaveBeenCalledWith('trips:read')
  })

  it('returns trip with empty departures', async () => {
    setupFirestoreMock({ tripExists: true, departures: [] })

    const request = new NextRequest('http://localhost/api/trips/trip-1')
    const response = await GET(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.departures).toHaveLength(0)
  })

  it('returns 404 for non-existent trip', async () => {
    setupFirestoreMock({ tripExists: false })

    const request = new NextRequest('http://localhost/api/trips/nonexistent')
    const response = await GET(request, makeParams('nonexistent'))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('TRIP_NOT_FOUND')
  })

  it('returns 403 when auth is denied', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso trips:read requerido', 403, false)
    )

    const request = new NextRequest('http://localhost/api/trips/trip-1')
    const response = await GET(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('INSUFFICIENT_PERMISSION')
  })
})

// === Tests: PATCH /api/trips/[tripId] ===

describe('PATCH /api/trips/[tripId]', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockGet.mockReset()
    mockDoc.mockReset()
    mockCollection.mockReset()
    mockUpdate.mockReset()
    mockOrderBy.mockReset()

    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)
    mockUpdate.mockResolvedValue(undefined)
  })

  it('updates editorial fields successfully', async () => {
    setupFirestoreMock({ tripExists: true })

    const request = new NextRequest('http://localhost/api/trips/trip-1', {
      method: 'PATCH',
      body: JSON.stringify({ slug: 'nuevo-slug', emotionalCopy: 'Viaja y descubre' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('trip-1')
    expect(data.slug).toBe('nuevo-slug')
    expect(data.emotionalCopy).toBe('Viaja y descubre')
    expect(data.updatedAt).toBeDefined()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'nuevo-slug',
        emotionalCopy: 'Viaja y descubre',
        updatedAt: expect.anything(),
      })
    )
    expect(mockRequirePermission).toHaveBeenCalledWith('trips:write')
  })

  it('updates isPublished field', async () => {
    setupFirestoreMock({ tripExists: true })

    const request = new NextRequest('http://localhost/api/trips/trip-1', {
      method: 'PATCH',
      body: JSON.stringify({ isPublished: false }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isPublished).toBe(false)
  })

  it('updates tags and highlights arrays', async () => {
    setupFirestoreMock({ tripExists: true })

    const request = new NextRequest('http://localhost/api/trips/trip-1', {
      method: 'PATCH',
      body: JSON.stringify({ tags: ['aventura', 'cultural'], highlights: ['Muralla China', 'Taj Mahal'] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.tags).toEqual(['aventura', 'cultural'])
    expect(data.highlights).toEqual(['Muralla China', 'Taj Mahal'])
  })

  it('returns 400 for invalid slug (not kebab-case)', async () => {
    const request = new NextRequest('http://localhost/api/trips/trip-1', {
      method: 'PATCH',
      body: JSON.stringify({ slug: 'Bad Slug With Spaces' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for empty slug', async () => {
    const request = new NextRequest('http://localhost/api/trips/trip-1', {
      method: 'PATCH',
      body: JSON.stringify({ slug: '' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  it('rejects unknown fields (strict schema)', async () => {
    const request = new NextRequest('http://localhost/api/trips/trip-1', {
      method: 'PATCH',
      body: JSON.stringify({ odooName: 'Hacked Name', slug: 'valid-slug' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for non-existent trip', async () => {
    setupFirestoreMock({ tripExists: false })

    const request = new NextRequest('http://localhost/api/trips/nonexistent', {
      method: 'PATCH',
      body: JSON.stringify({ slug: 'valid-slug' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, makeParams('nonexistent'))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('TRIP_NOT_FOUND')
  })

  it('returns 403 when auth is denied', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso trips:edit requerido', 403, false)
    )

    const request = new NextRequest('http://localhost/api/trips/trip-1', {
      method: 'PATCH',
      body: JSON.stringify({ slug: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('INSUFFICIENT_PERMISSION')
  })
})
