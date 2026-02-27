import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { getStorage } from 'firebase-admin/storage'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * POST /api/users/[uid]/profile-photo — Upload profile photo
 * Owner only. Validates file type and size, uploads to Firebase Storage.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const caller = await requireAuth()
    const { uid } = await params

    if (caller.uid !== uid) {
      throw new AppError('INSUFFICIENT_PERMISSIONS', 'Solo puedes actualizar tu propia foto', 403, false)
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof Blob)) {
      throw new AppError('PHOTO_REQUIRED', 'Archivo requerido', 400, false)
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new AppError(
        'PHOTO_INVALID_TYPE',
        'Tipo de archivo invalido — solo JPG, PNG o WebP',
        400,
        false
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new AppError('PHOTO_TOO_LARGE', 'Archivo excede 5MB', 400, false)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const bucket = getStorage().bucket()
    const filePath = `users/${uid}/profile/avatar`
    const fileRef = bucket.file(filePath)

    await fileRef.save(buffer, {
      metadata: { contentType: file.type },
    })

    // Decision: profile photos are public URLs (like social platforms).
    // Acceptable for a travel agency — avatars are non-sensitive.
    await fileRef.makePublic()
    const photoURL = `https://storage.googleapis.com/${bucket.name}/${filePath}`

    await adminDb.collection('users').doc(uid).update({
      photoURL,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ photoURL })
  } catch (error) {
    return handleApiError(error)
  }
}
