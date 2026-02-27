import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { deleteFile } from '@/lib/firebase/storage'
import type { TripDocument } from '@/types/trip'

const TRIPS_COLLECTION = 'trips'

type RouteParams = { params: Promise<{ tripId: string; documentId: string }> }

/**
 * DELETE /api/trips/[tripId]/documents/[documentId] — Delete trip document
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission('trips:write')
    const { tripId, documentId } = await params

    const tripRef = adminDb.collection(TRIPS_COLLECTION).doc(tripId)
    const tripSnap = await tripRef.get()

    if (!tripSnap.exists) {
      throw new AppError('TRIP_NOT_FOUND', 'Viaje no encontrado', 404)
    }

    const documents = (tripSnap.data()?.documents as TripDocument[]) ?? []
    const docToDelete = documents.find((d) => d.id === documentId)

    if (!docToDelete) {
      throw new AppError('DOCUMENT_NOT_FOUND', 'Documento no encontrado', 404)
    }

    const storagePath = `trips/${tripId}/documents/${documentId}.pdf`
    await deleteFile(storagePath)

    await tripRef.update({
      documents: FieldValue.arrayRemove(docToDelete),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ deleted: documentId })
  } catch (error) {
    return handleApiError(error)
  }
}
