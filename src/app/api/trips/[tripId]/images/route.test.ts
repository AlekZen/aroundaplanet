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

function setupFirestoreMock(opts: { tripExists: boolean; heroImages?: string[] }) {
  const tripSnap = {
    exists: opts.tripExists,
    id: 'trip-1',
    data: () => ({ heroImages: opts.heroImages ?? [] }),
  }

  const tripDocRef = {
    get: vi.fn().mockResolvedValue(tripSnap),
    update: mockUpdate,
  }

  mockDoc.mockReturnValue(tripDocRef)
  mockCollection.mockReturnValue({ doc: mockDoc })
}

function makeImageRequest(tripId: string, fileOpts?: { type: string; name: string }) {
  const request = new NextRequest(`http://localhost/api/trips/${tripId}/images`, {
    method: 'POST',
  })

  const formData = new FormData()
  if (fileOpts) {
    const file = new File(['fake-image-data'], fileOpts.name, { type: fileOpts.type })
    formData.append('file', file)
  }

  vi.spyOn(request, 'formData').mockResolvedValue(formData)
  return request
}

// === Tests ===

describe('POST /api/trips/[tripId]/images', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockDoc.mockReset()
    mockCollection.mockReset()
    mockUpdate.mockReset()
    mockUploadFile.mockReset()
    mockValidateFile.mockReset()

    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)
    mockUpdate.mockResolvedValue(undefined)
    mockUploadFile.mockResolvedValue('https://storage.googleapis.com/bucket/trips/trip-1/hero/12345.webp')
  })

  it('uploads image and updates heroImages', async () => {
    setupFirestoreMock({ tripExists: true, heroImages: [] })

    const file = new File(['fake-image-data'], 'hero.webp', { type: 'image/webp' })
    mockValidateFile.mockReturnValue(file)

    const request = makeImageRequest('trip-1', { type: 'image/webp', name: 'hero.webp' })
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.url).toBe('https://storage.googleapis.com/bucket/trips/trip-1/hero/12345.webp')
    expect(data.storagePath).toContain('trips/trip-1/hero/')
    expect(mockRequirePermission).toHaveBeenCalledWith('trips:write')
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.stringContaining('trips/trip-1/hero/'),
      expect.any(Buffer),
      'image/webp'
    )
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        heroImages: expect.anything(),
        updatedAt: expect.anything(),
      })
    )
  })

  it('returns 400 for invalid file type', async () => {
    setupFirestoreMock({ tripExists: true, heroImages: [] })

    const { AppError } = await import('@/lib/errors/AppError')
    mockValidateFile.mockImplementation(() => {
      throw new AppError('FILE_INVALID_TYPE', 'Tipo de archivo invalido', 400)
    })

    const request = makeImageRequest('trip-1', { type: 'image/gif', name: 'hero.gif' })
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('FILE_INVALID_TYPE')
  })

  it('returns 400 when max images reached (5)', async () => {
    setupFirestoreMock({
      tripExists: true,
      heroImages: [
        'https://storage/img1.webp',
        'https://storage/img2.webp',
        'https://storage/img3.webp',
        'https://storage/img4.webp',
        'https://storage/img5.webp',
      ],
    })

    const request = makeImageRequest('trip-1', { type: 'image/webp', name: 'hero.webp' })
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('MAX_IMAGES_REACHED')
    expect(mockUploadFile).not.toHaveBeenCalled()
  })

  it('returns 404 for non-existent trip', async () => {
    setupFirestoreMock({ tripExists: false })

    const request = makeImageRequest('nonexistent', { type: 'image/webp', name: 'hero.webp' })
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

    const request = makeImageRequest('trip-1', { type: 'image/webp', name: 'hero.webp' })
    const response = await POST(request, makeParams('trip-1'))
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('INSUFFICIENT_PERMISSION')
  })

  it('allows upload when heroImages has fewer than max', async () => {
    setupFirestoreMock({
      tripExists: true,
      heroImages: ['https://storage/img1.webp', 'https://storage/img2.webp'],
    })

    const file = new File(['fake-image-data'], 'hero.webp', { type: 'image/webp' })
    mockValidateFile.mockReturnValue(file)

    const request = makeImageRequest('trip-1', { type: 'image/webp', name: 'hero.webp' })
    const response = await POST(request, makeParams('trip-1'))

    expect(response.status).toBe(201)
    expect(mockUploadFile).toHaveBeenCalled()
  })
})
