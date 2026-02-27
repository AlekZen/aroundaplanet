import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockRequireAuth = vi.hoisted(() => vi.fn())
const mockUserDocUpdate = vi.hoisted(() => vi.fn())
const mockFieldValueServerTimestamp = vi.hoisted(() => vi.fn())
const mockFileSave = vi.hoisted(() => vi.fn())
const mockFileMakePublic = vi.hoisted(() => vi.fn())
const mockBucketFile = vi.hoisted(() => vi.fn())
const mockGetStorage = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: mockRequireAuth,
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        update: mockUserDocUpdate,
      })),
    })),
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: mockFieldValueServerTimestamp,
  },
}))

vi.mock('firebase-admin/storage', () => ({
  getStorage: mockGetStorage,
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: vi.fn((error: unknown) => {
    const err = error as { code?: string; message?: string; status?: number; retryable?: boolean }
    if (err.code && err.status) {
      return Response.json(
        { code: err.code, message: err.message ?? 'Error', retryable: err.retryable ?? false },
        { status: err.status }
      )
    }
    return Response.json(
      { code: 'INTERNAL_ERROR', message: 'Error interno', retryable: true },
      { status: 500 }
    )
  }),
}))

const FAKE_TIMESTAMP = { _seconds: 1234567890, _nanoseconds: 0 }

function makeParams(uid: string) {
  return { params: Promise.resolve({ uid }) }
}

/** Create a NextRequest with a mocked formData() that returns a controlled File */
function makePhotoRequest(
  uid: string,
  fileOpts?: { size: number; type: string; name: string }
) {
  const request = new NextRequest(`http://localhost/api/users/${uid}/profile-photo`, {
    method: 'POST',
  })

  const formData = new FormData()
  if (fileOpts) {
    // Create a real File object with proper type/size for the mock
    const content = new Uint8Array(fileOpts.size)
    const file = new File([content], fileOpts.name, { type: fileOpts.type })
    formData.append('file', file)
  }

  // Override formData() to return our controlled FormData directly
  vi.spyOn(request, 'formData').mockResolvedValue(formData)
  return request
}

describe('POST /api/users/[uid]/profile-photo', () => {
  beforeEach(() => {
    mockRequireAuth.mockReset()
    mockUserDocUpdate.mockReset()
    mockFieldValueServerTimestamp.mockReset()
    mockFileSave.mockReset()
    mockFileMakePublic.mockReset()
    mockBucketFile.mockReset()
    mockGetStorage.mockReset()

    mockRequireAuth.mockResolvedValue({ uid: 'user1', roles: ['cliente'] })
    mockUserDocUpdate.mockResolvedValue(undefined)
    mockFieldValueServerTimestamp.mockReturnValue(FAKE_TIMESTAMP)
    mockFileSave.mockResolvedValue(undefined)
    mockFileMakePublic.mockResolvedValue(undefined)
    mockBucketFile.mockReturnValue({
      save: mockFileSave,
      makePublic: mockFileMakePublic,
    })
    mockGetStorage.mockReturnValue({
      bucket: () => ({
        name: 'test-bucket',
        file: mockBucketFile,
      }),
    })
  })

  it('uploads photo and returns photoURL', async () => {
    const { POST } = await import('./route')
    const response = await POST(
      makePhotoRequest('user1', { size: 1024, type: 'image/jpeg', name: 'avatar.jpg' }),
      makeParams('user1')
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.photoURL).toBe('https://storage.googleapis.com/test-bucket/users/user1/profile/avatar')
  })

  it('saves file to correct Storage path with contentType', async () => {
    const { POST } = await import('./route')
    await POST(
      makePhotoRequest('user1', { size: 2048, type: 'image/png', name: 'avatar.png' }),
      makeParams('user1')
    )

    expect(mockBucketFile).toHaveBeenCalledWith('users/user1/profile/avatar')
    expect(mockFileSave).toHaveBeenCalledWith(
      expect.any(Buffer),
      { metadata: { contentType: 'image/png' } }
    )
    expect(mockFileMakePublic).toHaveBeenCalled()
  })

  it('updates Firestore with photoURL and updatedAt', async () => {
    const { POST } = await import('./route')
    await POST(
      makePhotoRequest('user1', { size: 512, type: 'image/jpeg', name: 'avatar.jpg' }),
      makeParams('user1')
    )

    expect(mockUserDocUpdate).toHaveBeenCalledWith({
      photoURL: 'https://storage.googleapis.com/test-bucket/users/user1/profile/avatar',
      updatedAt: FAKE_TIMESTAMP,
    })
  })

  describe('authorization', () => {
    it('returns 401 when not authenticated', async () => {
      const { AppError } = await import('@/lib/errors/AppError')
      mockRequireAuth.mockRejectedValue(
        new AppError('AUTH_REQUIRED', 'Autenticacion requerida', 401, false)
      )

      const { POST } = await import('./route')
      const response = await POST(
        makePhotoRequest('user1', { size: 100, type: 'image/jpeg', name: 'a.jpg' }),
        makeParams('user1')
      )

      expect(response.status).toBe(401)
    })

    it('returns 403 when trying to update another user photo', async () => {
      mockRequireAuth.mockResolvedValue({ uid: 'other-user', roles: ['cliente'] })

      const { POST } = await import('./route')
      const response = await POST(
        makePhotoRequest('user1', { size: 100, type: 'image/jpeg', name: 'a.jpg' }),
        makeParams('user1')
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.code).toBe('INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('file validation', () => {
    it('returns 400 when no file provided', async () => {
      const { POST } = await import('./route')
      const response = await POST(
        makePhotoRequest('user1'), // no file
        makeParams('user1')
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.code).toBe('PHOTO_REQUIRED')
    })

    it('returns 400 for unsupported file type (gif)', async () => {
      const { POST } = await import('./route')
      const response = await POST(
        makePhotoRequest('user1', { size: 100, type: 'image/gif', name: 'avatar.gif' }),
        makeParams('user1')
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.code).toBe('PHOTO_INVALID_TYPE')
    })

    it('accepts image/webp files', async () => {
      const { POST } = await import('./route')
      const response = await POST(
        makePhotoRequest('user1', { size: 100, type: 'image/webp', name: 'avatar.webp' }),
        makeParams('user1')
      )

      expect(response.status).toBe(200)
    })

    it('accepts image/png files', async () => {
      const { POST } = await import('./route')
      const response = await POST(
        makePhotoRequest('user1', { size: 100, type: 'image/png', name: 'avatar.png' }),
        makeParams('user1')
      )

      expect(response.status).toBe(200)
    })

    it('returns 400 when file exceeds 5MB', async () => {
      const { POST } = await import('./route')
      const response = await POST(
        makePhotoRequest('user1', { size: 5 * 1024 * 1024 + 1, type: 'image/jpeg', name: 'big.jpg' }),
        makeParams('user1')
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.code).toBe('PHOTO_TOO_LARGE')
    })
  })
})
