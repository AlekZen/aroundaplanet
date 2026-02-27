import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// === Hoisted mocks ===

const { mockRequirePermission, mockDoc, mockCollection, mockUpdate, mockDepGet } = vi.hoisted(() => {
  const mockRequirePermission = vi.fn()
  const mockDoc = vi.fn()
  const mockCollection = vi.fn()
  const mockUpdate = vi.fn()
  const mockDepGet = vi.fn()
  return { mockRequirePermission, mockDoc, mockCollection, mockUpdate, mockDepGet }
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

import { PATCH } from './route'

// === Helpers ===

const MOCK_CLAIMS = { uid: 'admin-uid', roles: ['admin'] }

function makeParams(tripId: string, departureId: string) {
  return { params: Promise.resolve({ tripId, departureId }) }
}

function makeRequest(tripId: string, departureId: string, body: unknown) {
  return new NextRequest(`http://localhost/api/trips/${tripId}/departures/${departureId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function setupFirestoreMock(opts: { depExists: boolean; syncSource?: string }) {
  const depSnap = {
    exists: opts.depExists,
    id: 'dep-1',
    data: () => ({
      syncSource: opts.syncSource ?? 'manual',
      odooName: 'Salida Marzo 2026',
      seatsMax: 20,
      isActive: true,
    }),
  }

  const depDocRef = {
    get: mockDepGet.mockResolvedValue(depSnap),
    update: mockUpdate,
  }

  const depCollectionRef = {
    doc: vi.fn().mockReturnValue(depDocRef),
  }

  const tripDocRef = {
    collection: vi.fn().mockReturnValue(depCollectionRef),
  }

  mockDoc.mockReturnValue(tripDocRef)
  mockCollection.mockReturnValue({ doc: mockDoc })
}

// === Tests ===

describe('PATCH /api/trips/[tripId]/departures/[departureId]', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockDoc.mockReset()
    mockCollection.mockReset()
    mockUpdate.mockReset()
    mockDepGet.mockReset()

    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)
    mockUpdate.mockResolvedValue(undefined)
  })

  it('updates departure fields (manual departure)', async () => {
    setupFirestoreMock({ depExists: true, syncSource: 'manual' })

    const request = makeRequest('trip-1', 'dep-1', { seatsMax: 30, isActive: false })
    const response = await PATCH(request, makeParams('trip-1', 'dep-1'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('dep-1')
    expect(data.seatsMax).toBe(30)
    expect(data.isActive).toBe(false)
    expect(data.updatedAt).toBeDefined()
    expect(mockRequirePermission).toHaveBeenCalledWith('trips:write')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        seatsMax: 30,
        isActive: false,
        updatedAt: expect.anything(),
      })
    )
  })

  it('allows updating only isActive on manual departure', async () => {
    setupFirestoreMock({ depExists: true, syncSource: 'manual' })

    const request = makeRequest('trip-1', 'dep-1', { isActive: false })
    const response = await PATCH(request, makeParams('trip-1', 'dep-1'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isActive).toBe(false)
  })

  it('allows updating only seatsMax on manual departure', async () => {
    setupFirestoreMock({ depExists: true, syncSource: 'manual' })

    const request = makeRequest('trip-1', 'dep-1', { seatsMax: 50 })
    const response = await PATCH(request, makeParams('trip-1', 'dep-1'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.seatsMax).toBe(50)
  })

  it('allows toggling isActive on Odoo-synced departure', async () => {
    setupFirestoreMock({ depExists: true, syncSource: 'odoo' })

    const request = makeRequest('trip-1', 'dep-1', { isActive: false })
    const response = await PATCH(request, makeParams('trip-1', 'dep-1'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isActive).toBe(false)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('rejects seatsMax update for Odoo-synced departure', async () => {
    setupFirestoreMock({ depExists: true, syncSource: 'odoo' })

    const request = makeRequest('trip-1', 'dep-1', { seatsMax: 30 })
    const response = await PATCH(request, makeParams('trip-1', 'dep-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('ODOO_FIELD_READONLY')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects seatsMax + isActive combo for Odoo-synced departure', async () => {
    setupFirestoreMock({ depExists: true, syncSource: 'odoo' })

    const request = makeRequest('trip-1', 'dep-1', { seatsMax: 30, isActive: false })
    const response = await PATCH(request, makeParams('trip-1', 'dep-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('ODOO_FIELD_READONLY')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 404 for non-existent departure', async () => {
    setupFirestoreMock({ depExists: false })

    const request = makeRequest('trip-1', 'nonexistent', { isActive: false })
    const response = await PATCH(request, makeParams('trip-1', 'nonexistent'))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('DEPARTURE_NOT_FOUND')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid data (unknown fields)', async () => {
    const request = makeRequest('trip-1', 'dep-1', { odooName: 'Hacked' })
    const response = await PATCH(request, makeParams('trip-1', 'dep-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 for seatsMax of 0', async () => {
    const request = makeRequest('trip-1', 'dep-1', { seatsMax: 0 })
    const response = await PATCH(request, makeParams('trip-1', 'dep-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for non-integer seatsMax', async () => {
    const request = makeRequest('trip-1', 'dep-1', { seatsMax: 20.5 })
    const response = await PATCH(request, makeParams('trip-1', 'dep-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 when auth is denied', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso trips:edit requerido', 403, false)
    )

    const request = makeRequest('trip-1', 'dep-1', { isActive: false })
    const response = await PATCH(request, makeParams('trip-1', 'dep-1'))
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('INSUFFICIENT_PERMISSION')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('accepts empty body (all fields optional)', async () => {
    setupFirestoreMock({ depExists: true, syncSource: 'manual' })

    const request = makeRequest('trip-1', 'dep-1', {})
    const response = await PATCH(request, makeParams('trip-1', 'dep-1'))

    // Empty object is valid for strict() — no unknown fields, all optional
    // The route will proceed but update with just updatedAt
    expect(response.status).toBe(200)
  })
})
