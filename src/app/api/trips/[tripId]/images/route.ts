import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { uploadFile, validateFile } from '@/lib/firebase/storage'

const TRIPS_COLLECTION = 'trips'
const MAX_HERO_IMAGES = 5
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type RouteParams = { params: Promise<{ tripId: string }> }

/**
 * POST /api/trips/[tripId]/images — Upload hero image
 * Appends to heroImages array. Max 5 images.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission('trips:write')
    const { tripId } = await params

    const tripRef = adminDb.collection(TRIPS_COLLECTION).doc(tripId)
    const tripSnap = await tripRef.get()

    if (!tripSnap.exists) {
      throw new AppError('TRIP_NOT_FOUND', 'Viaje no encontrado', 404)
    }

    const currentImages = (tripSnap.data()?.heroImages as string[]) ?? []
    if (currentImages.length >= MAX_HERO_IMAGES) {
      throw new AppError('MAX_IMAGES_REACHED', `Maximo ${MAX_HERO_IMAGES} imagenes permitidas`, 400)
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const validatedFile = validateFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE)

    const buffer = Buffer.from(await validatedFile.arrayBuffer())
    const ext = validatedFile.type.split('/')[1] ?? 'webp'
    const filename = `${Date.now()}.${ext}`
    const storagePath = `trips/${tripId}/hero/${filename}`

    const url = await uploadFile(storagePath, buffer, validatedFile.type)

    await tripRef.update({
      heroImages: FieldValue.arrayUnion(url),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ url, storagePath }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
