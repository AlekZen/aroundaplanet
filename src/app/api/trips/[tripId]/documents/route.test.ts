import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// === Hoisted mocks ===

const { mockRequirePermission, mockDoc, mockCollection, mockUpdate, mockUploadFile, mockValidateFile } = vi.hoisted(() => {
  const mockRequirePermission = vi.fn()
  const mockDoc = vi.fn()
  const mockCollection = vi.fn()
  const mockUpdate = vi.fn()
  const mockUploadFile = vi.fn()
  const mockValidateFile = vi.fn()
  return { mockRequirePermission, mockDoc, mockCollection, mockUpdate, mockUploadFile, mockValidateFile }
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
  uploadFile: mockUploadFile,
  validateFile: mockValidateFile,
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

import { POST } from './route'

// === Helpers ===

const MOCK_CLAIMS = { uid: 'admin-uid', roles: ['admin'] }

function makeParams(tripId: string) {
  return { params: Promise.resolve({ tripId }) }
}

function setupFirestoreMock(opts: { tripExists: boolean; documents?: unknown[] }) {
  const tripSnap = {
    exists: opts.tripExists,
    id: 'trip-1',
    data: () => ({ documents: opts.documents ?? [] }),
  }

  const tripDocRef = {
    get: vi.fn().mockResolvedValue(tripSnap),
    update: mockUpdate,
  }

  mockDoc.mockReturnValue(tripDocRef)
  mockCollection.mockReturnValue({ doc: mockDoc })
}

function makeDocumentRequest(tripId: string, fileOpts?: { type: string; name: string }, docName?: string) {
  const request = new NextRequest(`http://localhost/api/trips/${tripId}/documents`, {
    method: 'POST',
  })

  const formData = new FormData()
  if (fileOpts) {
    const file = new File(['fake-pdf-content'], fileOpts.name, { type: fileOpts.type })
    formData.append('file', file)
  }
  if (docName) {
    formData.append('name', docName)
  }

  vi.spyOn(request, 'formData').mockResolvedValue(formData)
  return request
}

// === Tests ===

describe('POST /api/trips/[tripId]/documents', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockDoc.mockReset()
    mockCollection.mockReset()
    mockUpdate.mockReset()
    mockUploadFile.mockReset()
    mockValidateFile.mockReset()

    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)
    mockUpdate.mockResolvedValue(undefined)
    mockUploadFile.mockResolvedValue('https://storage.googleapis.com/bucket/trips/trip-1/documents/12345.pdf')
  })

  it('uploads document and updates documents array', async () => {
    setupFirestoreMock({ tripExists: true, documents: [] })

    const file = new File(['fake-pdf'], 'itinerary.pdf', { type: 'application/pdf' })
    mockValidateFile.mockReturnValue(file)

    const request = makeDocumentRequest('trip-1', { type: 'application/pdf', name: 'itinerary.pdf' }, 'Itinerario Completo')
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.url).toBe('https://storage.googleapis.com/bucket/trips/trip-1/documents/12345.pdf')
    expect(data.name).toBe('Itinerario Completo')
    expect(data.type).toBe('application/pdf')
    expect(data.id).toBeDefined()
    expect(data.uploadedAt).toBeDefined()
    expect(mockRequirePermission).toHaveBeenCalledWith('trips:write')
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.stringContaining('trips/trip-1/documents/'),
      expect.any(Buffer),
      'application/pdf'
    )
  })

  it('uses default name when no name provided', async () => {
    setupFirestoreMock({ tripExists: true, documents: [{ id: 'doc-1' }, { id: 'doc-2' }] })

    const file = new File(['fake-pdf'], 'doc.pdf', { type: 'application/pdf' })
    mockValidateFile.mockReturnValue(file)

    const request = makeDocumentRequest('trip-1', { type: 'application/pdf', name: 'doc.pdf' })
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.name).toBe('Documento 3')
  })

  it('returns 400 for invalid file type (non-PDF)', async () => {
    setupFirestoreMock({ tripExists: true, documents: [] })

    const { AppError } = await import('@/lib/errors/AppError')
    mockValidateFile.mockImplementation(() => {
      throw new AppError('FILE_INVALID_TYPE', 'Tipo de archivo invalido — solo pdf', 400)
    })

    const request = makeDocumentRequest('trip-1', { type: 'image/jpeg', name: 'photo.jpg' })
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('FILE_INVALID_TYPE')
    expect(mockUploadFile).not.toHaveBeenCalled()
  })

  it('returns 400 when max documents reached (10)', async () => {
    const tenDocs = Array.from({ length: 10 }, (_, i) => ({
      id: `doc-${i}`,
      name: `Documento ${i + 1}`,
      url: `https://storage/doc-${i}.pdf`,
      type: 'application/pdf',
      uploadedAt: '2026-01-01T00:00:00.000Z',
    }))
    setupFirestoreMock({ tripExists: true, documents: tenDocs })

    const request = makeDocumentRequest('trip-1', { type: 'application/pdf', name: 'extra.pdf' }, 'Extra')
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('MAX_DOCUMENTS_REACHED')
    expect(mockUploadFile).not.toHaveBeenCalled()
  })

  it('returns 404 for non-existent trip', async () => {
    setupFirestoreMock({ tripExists: false })

    const request = makeDocumentRequest('nonexistent', { type: 'application/pdf', name: 'doc.pdf' }, 'Test')
    const response = await POST(request, makeParams('nonexistent'))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('TRIP_NOT_FOUND')
    expect(mockUploadFile).not.toHaveBeenCalled()
  })

  it('returns 403 when auth is denied', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso trips:edit requerido', 403, false)
    )

    const request = makeDocumentRequest('trip-1', { type: 'application/pdf', name: 'doc.pdf' })
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('INSUFFICIENT_PERMISSION')
  })

  it('calls arrayUnion to append document to array', async () => {
    setupFirestoreMock({ tripExists: true, documents: [] })

    const file = new File(['pdf-content'], 'test.pdf', { type: 'application/pdf' })
    mockValidateFile.mockReturnValue(file)

    const request = makeDocumentRequest('trip-1', { type: 'application/pdf', name: 'test.pdf' }, 'Test Doc')
    await POST(request, makeParams('trip-1'))

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: expect.objectContaining({
          _arrayUnion: expect.arrayContaining([
            expect.objectContaining({
              name: 'Test Doc',
              type: 'application/pdf',
              url: expect.any(String),
            }),
          ]),
        }),
        updatedAt: expect.anything(),
      })
    )
  })
})
