import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { tripEditorialUpdateSchema } from '@/schemas/tripSchema'

const TRIPS_COLLECTION = 'trips'
const DEPARTURES_SUBCOLLECTION = 'departures'

type RouteParams = { params: Promise<{ tripId: string }> }

/**
 * GET /api/trips/[tripId] — Single trip with departures
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission('trips:read')
    const { tripId } = await params

    const [tripSnap, departuresSnap] = await Promise.all([
      adminDb.collection(TRIPS_COLLECTION).doc(tripId).get(),
      adminDb.collection(TRIPS_COLLECTION).doc(tripId)
        .collection(DEPARTURES_SUBCOLLECTION).orderBy('startDate').get(),
    ])

    if (!tripSnap.exists) {
      throw new AppError('TRIP_NOT_FOUND', 'Viaje no encontrado', 404)
    }

    const departures = departuresSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Exclude odooImageBase64 from response (multi-MB base64 string)
    const { odooImageBase64: _omit, ...tripData } = tripSnap.data() as Record<string, unknown>

    return NextResponse.json({
      id: tripSnap.id,
      ...tripData,
      departures,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PATCH /api/trips/[tripId] — Update editorial fields only
 * NEVER touches odoo* fields.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission('trips:write')
    const { tripId } = await params

    const body = await request.json()
    const parsed = tripEditorialUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos invalidos', retryable: false },
        { status: 400 }
      )
    }

    const tripRef = adminDb.collection(TRIPS_COLLECTION).doc(tripId)
    const tripSnap = await tripRef.get()

    if (!tripSnap.exists) {
      throw new AppError('TRIP_NOT_FOUND', 'Viaje no encontrado', 404)
    }

    const updateData: Record<string, unknown> = {
      ...parsed.data,
      updatedAt: FieldValue.serverTimestamp(),
    }

    await tripRef.update(updateData)

    return NextResponse.json({
      id: tripId,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
