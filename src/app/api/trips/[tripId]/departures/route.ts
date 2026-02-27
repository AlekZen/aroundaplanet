import { NextRequest, NextResponse } from 'next/server'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { tripDepartureCreateSchema } from '@/schemas/tripSchema'

const TRIPS_COLLECTION = 'trips'
const DEPARTURES_SUBCOLLECTION = 'departures'

type RouteParams = { params: Promise<{ tripId: string }> }

/**
 * POST /api/trips/[tripId]/departures — Create manual departure
 * For use while Odoo Events module is empty.
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

    const body = await request.json()
    const parsed = tripDepartureCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos invalidos', retryable: false },
        { status: 400 }
      )
    }

    const { name, startDate, endDate, seatsMax } = parsed.data
    const now = FieldValue.serverTimestamp()

    const departureData = {
      odooEventId: null,
      odooName: name,
      startDate: Timestamp.fromDate(new Date(startDate)),
      endDate: Timestamp.fromDate(new Date(endDate)),
      dateTimezone: null,
      seatsMax,
      seatsAvailable: seatsMax,
      seatsUsed: 0,
      seatsReserved: 0,
      seatsTaken: 0,
      isActive: true,
      isPublished: false,
      syncSource: 'manual' as const,
      odooWriteDate: null,
      lastSyncAt: now,
      createdAt: now,
      updatedAt: now,
    }

    const depRef = await tripRef.collection(DEPARTURES_SUBCOLLECTION).add(departureData)

    return NextResponse.json({
      id: depRef.id,
      name,
      startDate,
      endDate,
      seatsMax,
      syncSource: 'manual',
      createdAt: new Date().toISOString(),
    }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
