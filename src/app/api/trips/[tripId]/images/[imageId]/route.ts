import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { deleteFile, getPublicUrl } from '@/lib/firebase/storage'

const TRIPS_COLLECTION = 'trips'

type RouteParams = { params: Promise<{ tripId: string; imageId: string }> }

/**
 * DELETE /api/trips/[tripId]/images/[imageId] — Delete hero image
 * imageId is the timestamp-based filename (e.g., "1740000000000.webp")
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission('trips:write')
    const { tripId, imageId } = await params

    const tripRef = adminDb.collection(TRIPS_COLLECTION).doc(tripId)
    const tripSnap = await tripRef.get()

    if (!tripSnap.exists) {
      throw new AppError('TRIP_NOT_FOUND', 'Viaje no encontrado', 404)
    }

    const storagePath = `trips/${tripId}/hero/${imageId}`
    const publicUrl = getPublicUrl(storagePath)

    await deleteFile(storagePath)

    await tripRef.update({
      heroImages: FieldValue.arrayRemove(publicUrl),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ deleted: imageId })
  } catch (error) {
    return handleApiError(error)
  }
}
