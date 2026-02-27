import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// === Hoisted mocks ===

const { mockRequirePermission, mockDoc, mockCollection, mockUpdate, mockDeleteFile, mockGetPublicUrl } = vi.hoisted(() => {
  const mockRequirePermission = vi.fn()
  const mockDoc = vi.fn()
  const mockCollection = vi.fn()
  const mockUpdate = vi.fn()
  const mockDeleteFile = vi.fn()
  const mockGetPublicUrl = vi.fn()
  return { mockRequirePermission, mockDoc, mockCollection, mockUpdate, mockDeleteFile, mockGetPublicUrl }
})

vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: mockRequirePermission,
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: mockCollection,
  },
}))

vi.mock('@/lib/firebase/storage', () => ({
  deleteFile: mockDeleteFile,
  getPublicUrl: mockGetPublicUrl,
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

import { DELETE } from './route'

// === Helpers ===

const MOCK_CLAIMS = { uid: 'admin-uid', roles: ['admin'] }

function makeParams(tripId: string, imageId: string) {
  return { params: Promise.resolve({ tripId, imageId }) }
}

function setupFirestoreMock(opts: { tripExists: boolean }) {
  const tripSnap = {
    exists: opts.tripExists,
    id: 'trip-1',
    data: () => ({}),
  }

  const tripDocRef = {
    get: vi.fn().mockResolvedValue(tripSnap),
    update: mockUpdate,
  }

  mockDoc.mockReturnValue(tripDocRef)
  mockCollection.mockReturnValue({ doc: mockDoc })
}

// === Tests ===

describe('DELETE /api/trips/[tripId]/images/[imageId]', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockDoc.mockReset()
    mockCollection.mockReset()
    mockUpdate.mockReset()
    mockDeleteFile.mockReset()
    mockGetPublicUrl.mockReset()

    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)
    mockUpdate.mockResolvedValue(undefined)
    mockDeleteFile.mockResolvedValue(undefined)
    mockGetPublicUrl.mockReturnValue('https://storage.googleapis.com/bucket/trips/trip-1/hero/1740000000000.webp')
  })

  it('deletes image from storage and updates Firestore', async () => {
    setupFirestoreMock({ tripExists: true })

    const request = new NextRequest('http://localhost/api/trips/trip-1/images/1740000000000.webp', {
      method: 'DELETE',
    })
    const response = await DELETE(request, makeParams('trip-1', '1740000000000.webp'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.deleted).toBe('1740000000000.webp')
    expect(mockRequirePermission).toHaveBeenCalledWith('trips:write')
    expect(mockDeleteFile).toHaveBeenCalledWith('trips/trip-1/hero/1740000000000.webp')
    expect(mockGetPublicUrl).toHaveBeenCalledWith('trips/trip-1/hero/1740000000000.webp')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        heroImages: expect.anything(),
        updatedAt: expect.anything(),
      })
    )
  })

  it('returns 404 for non-existent trip', async () => {
    setupFirestoreMock({ tripExists: false })

    const request = new NextRequest('http://localhost/api/trips/nonexistent/images/1740000000000.webp', {
      method: 'DELETE',
    })
    const response = await DELETE(request, makeParams('nonexistent', '1740000000000.webp'))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('TRIP_NOT_FOUND')
    expect(mockDeleteFile).not.toHaveBeenCalled()
  })

  it('returns 403 when auth is denied', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso trips:edit requerido', 403, false)
    )

    const request = new NextRequest('http://localhost/api/trips/trip-1/images/1740000000000.webp', {
      method: 'DELETE',
    })
    const response = await DELETE(request, makeParams('trip-1', '1740000000000.webp'))
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('INSUFFICIENT_PERMISSION')
    expect(mockDeleteFile).not.toHaveBeenCalled()
  })

  it('calls deleteFile before updating Firestore', async () => {
    setupFirestoreMock({ tripExists: true })

    const callOrder: string[] = []
    mockDeleteFile.mockImplementation(async () => { callOrder.push('delete') })
    mockUpdate.mockImplementation(async () => { callOrder.push('update') })

    const request = new NextRequest('http://localhost/api/trips/trip-1/images/test.webp', {
      method: 'DELETE',
    })
    await DELETE(request, makeParams('trip-1', 'test.webp'))

    expect(callOrder).toEqual(['delete', 'update'])
  })

  it('handles storage deletion errors', async () => {
    setupFirestoreMock({ tripExists: true })
    mockDeleteFile.mockRejectedValue(new Error('Storage unavailable'))

    const request = new NextRequest('http://localhost/api/trips/trip-1/images/test.webp', {
      method: 'DELETE',
    })
    const response = await DELETE(request, makeParams('trip-1', 'test.webp'))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.code).toBe('INTERNAL_ERROR')
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
