import { getStorage } from 'firebase-admin/storage'
import { AppError } from '@/lib/errors/AppError'

// === Constants ===

const STORAGE_BASE_URL = 'https://storage.googleapis.com'

// === Generic Storage Helpers ===

/**
 * Upload a file to Firebase Storage, make it public, and return its URL.
 * Path-agnostic: caller constructs full storage path (e.g., `trips/${tripId}/hero/${filename}`).
 */
export async function uploadFile(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const bucket = getStorage().bucket()
  const fileRef = bucket.file(storagePath)

  await fileRef.save(buffer, {
    metadata: { contentType },
  })

  await fileRef.makePublic()
  return `${STORAGE_BASE_URL}/${bucket.name}/${storagePath}`
}

/**
 * Delete a file from Firebase Storage.
 * Silently ignores if file doesn't exist (idempotent).
 */
export async function deleteFile(storagePath: string): Promise<void> {
  const bucket = getStorage().bucket()
  const fileRef = bucket.file(storagePath)

  try {
    await fileRef.delete()
  } catch (error: unknown) {
    const code = (error as { code?: number })?.code
    if (code === 404) return // File already gone, idempotent
    throw error
  }
}

/**
 * Construct the public URL for a file in Firebase Storage.
 * Does NOT verify that the file exists.
 */
export function getPublicUrl(storagePath: string): string {
  const bucket = getStorage().bucket()
  return `${STORAGE_BASE_URL}/${bucket.name}/${storagePath}`
}

/**
 * Validate a file from FormData. Returns the validated Blob.
 * Throws AppError on validation failure.
 */
export function validateFile(
  file: FormDataEntryValue | null,
  allowedTypes: string[],
  maxSizeBytes: number
): Blob {
  if (!file || !(file instanceof Blob)) {
    throw new AppError('FILE_REQUIRED', 'Archivo requerido', 400)
  }

  if (!allowedTypes.includes(file.type)) {
    throw new AppError(
      'FILE_INVALID_TYPE',
      `Tipo de archivo invalido — solo ${allowedTypes.map((t) => t.split('/')[1]).join(', ')}`,
      400
    )
  }

  if (file.size > maxSizeBytes) {
    const maxMB = Math.round(maxSizeBytes / (1024 * 1024))
    throw new AppError('FILE_TOO_LARGE', `Archivo excede ${maxMB}MB`, 400)
  }

  return file
}
