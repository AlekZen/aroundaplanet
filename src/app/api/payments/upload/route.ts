import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from 'firebase-admin/storage'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

/**
 * POST /api/payments/upload — Upload payment receipt to Firebase Storage
 * Returns the public URL of the uploaded file
 */
export async function POST(request: NextRequest) {
  try {
    const claims = await requireAuth()

    const formData = await request.formData()
    const file = formData.get('file')
    const orderId = formData.get('orderId')

    if (!file || !(file instanceof Blob)) {
      throw new AppError('VALIDATION_ERROR', 'Archivo de imagen requerido', 400)
    }

    if (!orderId || typeof orderId !== 'string') {
      throw new AppError('VALIDATION_ERROR', 'orderId requerido', 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new AppError('VALIDATION_ERROR', 'La imagen no puede pesar mas de 10MB', 400)
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new AppError('VALIDATION_ERROR', 'Formato no soportado. Usa JPG, PNG o WebP', 400)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.type.split('/')[1] ?? 'jpg'
    const timestamp = Date.now()
    const filePath = `payments/${orderId}/${claims.uid}-${timestamp}.${ext}`

    const bucket = getStorage().bucket()
    const fileRef = bucket.file(filePath)

    await fileRef.save(buffer, {
      metadata: { contentType: file.type },
    })

    await fileRef.makePublic()
    const receiptUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`

    return NextResponse.json({ receiptUrl })
  } catch (error) {
    return handleApiError(error)
  }
}
