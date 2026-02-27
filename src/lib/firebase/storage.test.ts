import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSave, mockDelete, mockMakePublic, mockFile, mockBucket } = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined)
  const mockDelete = vi.fn().mockResolvedValue(undefined)
  const mockMakePublic = vi.fn().mockResolvedValue(undefined)
  const mockFile = vi.fn().mockReturnValue({
    save: mockSave,
    delete: mockDelete,
    makePublic: mockMakePublic,
  })
  const mockBucket = vi.fn().mockReturnValue({
    name: 'arounda-planet.firebasestorage.app',
    file: mockFile,
  })
  return { mockSave, mockDelete, mockMakePublic, mockFile, mockBucket }
})

vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn().mockReturnValue({ bucket: mockBucket }),
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

import { uploadFile, deleteFile, getPublicUrl, validateFile } from './storage'

describe('Firebase Storage helpers', () => {
  beforeEach(() => {
    mockSave.mockReset().mockResolvedValue(undefined)
    mockDelete.mockReset().mockResolvedValue(undefined)
    mockMakePublic.mockReset().mockResolvedValue(undefined)
    mockFile.mockClear().mockReturnValue({
      save: mockSave,
      delete: mockDelete,
      makePublic: mockMakePublic,
    })
  })

  describe('uploadFile', () => {
    it('uploads file, makes public, and returns URL', async () => {
      const buffer = Buffer.from('test-image-data')
      const url = await uploadFile('trips/abc/hero/photo.webp', buffer, 'image/webp')

      expect(mockFile).toHaveBeenCalledWith('trips/abc/hero/photo.webp')
      expect(mockSave).toHaveBeenCalledWith(buffer, {
        metadata: { contentType: 'image/webp' },
      })
      expect(mockMakePublic).toHaveBeenCalled()
      expect(url).toBe(
        'https://storage.googleapis.com/arounda-planet.firebasestorage.app/trips/abc/hero/photo.webp'
      )
    })

    it('propagates storage errors', async () => {
      mockSave.mockRejectedValueOnce(new Error('Storage unavailable'))
      const buffer = Buffer.from('test')

      await expect(uploadFile('path/file.jpg', buffer, 'image/jpeg')).rejects.toThrow(
        'Storage unavailable'
      )
    })
  })

  describe('deleteFile', () => {
    it('deletes file from storage', async () => {
      await deleteFile('trips/abc/hero/photo.webp')

      expect(mockFile).toHaveBeenCalledWith('trips/abc/hero/photo.webp')
      expect(mockDelete).toHaveBeenCalled()
    })

    it('silently ignores 404 (file already deleted)', async () => {
      mockDelete.mockRejectedValueOnce({ code: 404 })

      await expect(deleteFile('trips/abc/hero/gone.webp')).resolves.toBeUndefined()
    })

    it('propagates non-404 errors', async () => {
      mockDelete.mockRejectedValueOnce({ code: 403, message: 'Permission denied' })

      await expect(deleteFile('trips/abc/hero/photo.webp')).rejects.toEqual(
        expect.objectContaining({ code: 403 })
      )
    })
  })

  describe('getPublicUrl', () => {
    it('constructs public URL without calling storage', () => {
      const url = getPublicUrl('trips/abc/documents/itinerary.pdf')

      expect(url).toBe(
        'https://storage.googleapis.com/arounda-planet.firebasestorage.app/trips/abc/documents/itinerary.pdf'
      )
    })
  })

  describe('validateFile', () => {
    const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
    const MAX_5MB = 5 * 1024 * 1024

    it('returns Blob for valid file', () => {
      const file = new File(['data'], 'photo.webp', { type: 'image/webp' })

      const result = validateFile(file, IMAGE_TYPES, MAX_5MB)
      expect(result).toBe(file)
    })

    it('throws FILE_REQUIRED for null', () => {
      expect(() => validateFile(null, IMAGE_TYPES, MAX_5MB)).toThrow('Archivo requerido')
    })

    it('throws FILE_REQUIRED for non-Blob', () => {
      expect(() => validateFile('string-value', IMAGE_TYPES, MAX_5MB)).toThrow('Archivo requerido')
    })

    it('throws FILE_INVALID_TYPE for wrong type', () => {
      const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' })
      expect(() => validateFile(file, IMAGE_TYPES, MAX_5MB)).toThrow('Tipo de archivo invalido')
    })

    it('throws FILE_TOO_LARGE for oversized file', () => {
      const file = new File(['data'], 'big.webp', { type: 'image/webp' })
      Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 })

      expect(() => validateFile(file, IMAGE_TYPES, MAX_5MB)).toThrow('excede 5MB')
    })

    it('accepts PDF when PDF is in allowed types', () => {
      const file = new File(['pdf-data'], 'doc.pdf', { type: 'application/pdf' })

      const result = validateFile(file, ['application/pdf'], 10 * 1024 * 1024)
      expect(result).toBe(file)
    })
  })
})
