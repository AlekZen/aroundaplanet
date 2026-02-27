import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// === Hoisted mocks ===

const { mockRequirePermission, mockDoc, mockCollection, mockUpdate, mockDeleteFile } = vi.hoisted(() => {
  const mockRequirePermission = vi.fn()
  const mockDoc = vi.fn()
  const mockCollection = vi.fn()
  const mockUpdate = vi.fn()
  const mockDeleteFile = vi.fn()
  return { mockRequirePermission, mockDoc, mockCollection, mockUpdate, mockDeleteFile }
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

const MOCK_DOCUMENTS = [
  {
    id: 'doc-100',
    name: 'Itinerario',
    url: 'https://storage/trips/trip-1/documents/doc-100.pdf',
    type: 'application/pdf',
    uploadedAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'doc-200',
    name: 'Contrato',
    url: 'https://storage/trips/trip-1/documents/doc-200.pdf',
    type: 'application/pdf',
    uploadedAt: '2026-01-16T10:00:00.000Z',
  },
]

function makeParams(tripId: string, documentId: string) {
  return { params: Promise.resolve({ tripId, documentId }) }
}

function setupFirestoreMock(opts: { tripExists: boolean; documents?: typeof MOCK_DOCUMENTS }) {
  const tripSnap = {
    exists: opts.tripExists,
    id: 'trip-1',
    data: () => ({ documents: opts.documents ?? MOCK_DOCUMENTS }),
  }

  const tripDocRef = {
    get: vi.fn().mockResolvedValue(tripSnap),
    update: mockUpdate,
  }

  mockDoc.mockReturnValue(tripDocRef)
  mockCollection.mockReturnValue({ doc: mockDoc })
}

// === Tests ===

describe('DELETE /api/trips/[tripId]/documents/[documentId]', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockDoc.mockReset()
    mockCollection.mockReset()
    mockUpdate.mockReset()
    mockDeleteFile.mockReset()

    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)
    mockUpdate.mockResolvedValue(undefined)
    mockDeleteFile.mockResolvedValue(undefined)
  })

  it('deletes document from storage and Firestore', async () => {
    setupFirestoreMock({ tripExists: true })

    const request = new NextRequest('http://localhost/api/trips/trip-1/documents/doc-100', {
      method: 'DELETE',
    })
    const response = await DELETE(request, makeParams('trip-1', 'doc-100'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.deleted).toBe('doc-100')
    expect(mockRequirePermission).toHaveBeenCalledWith('trips:write')
    expect(mockDeleteFile).toHaveBeenCalledWith('trips/trip-1/documents/doc-100.pdf')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: expect.objectContaining({
          _arrayRemove: expect.arrayContaining([
            expect.objectContaining({
              id: 'doc-100',
              name: 'Itinerario',
            }),
          ]),
        }),
        updatedAt: expect.anything(),
      })
    )
  })

  it('returns 404 for non-existent trip', async () => {
    setupFirestoreMock({ tripExists: false })

    const request = new NextRequest('http://localhost/api/trips/nonexistent/documents/doc-100', {
      method: 'DELETE',
    })
    const response = await DELETE(request, makeParams('nonexistent', 'doc-100'))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('TRIP_NOT_FOUND')
    expect(mockDeleteFile).not.toHaveBeenCalled()
  })

  it('returns 404 for non-existent document', async () => {
    setupFirestoreMock({ tripExists: true })

    const request = new NextRequest('http://localhost/api/trips/trip-1/documents/doc-999', {
      method: 'DELETE',
    })
    const response = await DELETE(request, makeParams('trip-1', 'doc-999'))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('DOCUMENT_NOT_FOUND')
    expect(mockDeleteFile).not.toHaveBeenCalled()
  })

  it('returns 403 when auth is denied', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso trips:edit requerido', 403, false)
    )

    const request = new NextRequest('http://localhost/api/trips/trip-1/documents/doc-100', {
      method: 'DELETE',
    })
    const response = await DELETE(request, makeParams('trip-1', 'doc-100'))
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('INSUFFICIENT_PERMISSION')
    expect(mockDeleteFile).not.toHaveBeenCalled()
  })

  it('deletes from storage before updating Firestore', async () => {
    setupFirestoreMock({ tripExists: true })

    const callOrder: string[] = []
    mockDeleteFile.mockImplementation(async () => { callOrder.push('deleteFile') })
    mockUpdate.mockImplementation(async () => { callOrder.push('firestoreUpdate') })

    const request = new NextRequest('http://localhost/api/trips/trip-1/documents/doc-100', {
      method: 'DELETE',
    })
    await DELETE(request, makeParams('trip-1', 'doc-100'))

    expect(callOrder).toEqual(['deleteFile', 'firestoreUpdate'])
  })

  it('handles empty documents array gracefully', async () => {
    setupFirestoreMock({ tripExists: true, documents: [] })

    const request = new NextRequest('http://localhost/api/trips/trip-1/documents/doc-100', {
      method: 'DELETE',
    })
    const response = await DELETE(request, makeParams('trip-1', 'doc-100'))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('DOCUMENT_NOT_FOUND')
  })
})
