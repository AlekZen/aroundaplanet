import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { uploadFile, validateFile } from '@/lib/firebase/storage'
import type { TripDocument } from '@/types/trip'

const TRIPS_COLLECTION = 'trips'
const MAX_DOCUMENTS = 10
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_DOCUMENT_TYPES = ['application/pdf']

type RouteParams = { params: Promise<{ tripId: string }> }

/**
 * POST /api/trips/[tripId]/documents — Upload trip document (PDF)
 * Appends to documents array. Max 10 documents.
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

    const currentDocs = (tripSnap.data()?.documents as TripDocument[]) ?? []
    if (currentDocs.length >= MAX_DOCUMENTS) {
      throw new AppError('MAX_DOCUMENTS_REACHED', `Maximo ${MAX_DOCUMENTS} documentos permitidos`, 400)
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const docName = formData.get('name')
    const validatedFile = validateFile(file, ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE)

    const displayName = typeof docName === 'string' && docName.trim().length > 0
      ? docName.trim()
      : `Documento ${currentDocs.length + 1}`

    const buffer = Buffer.from(await validatedFile.arrayBuffer())
    const documentId = `${Date.now()}`
    const filename = `${documentId}.pdf`
    const storagePath = `trips/${tripId}/documents/${filename}`

    const url = await uploadFile(storagePath, buffer, validatedFile.type)

    const newDoc: TripDocument = {
      id: documentId,
      name: displayName,
      url,
      type: 'application/pdf',
      uploadedAt: new Date().toISOString(),
    }

    await tripRef.update({
      documents: FieldValue.arrayUnion(newDoc),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json(newDoc, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
