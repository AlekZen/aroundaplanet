import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { tripDepartureUpdateSchema } from '@/schemas/tripSchema'

const TRIPS_COLLECTION = 'trips'
const DEPARTURES_SUBCOLLECTION = 'departures'

type RouteParams = { params: Promise<{ tripId: string; departureId: string }> }

/**
 * PATCH /api/trips/[tripId]/departures/[departureId] — Update departure
 * Only seatsMax and isActive can be updated.
 * Odoo-synced departures: only isActive can be toggled.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission('trips:write')
    const { tripId, departureId } = await params

    const body = await request.json()
    const parsed = tripDepartureUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos invalidos', retryable: false },
        { status: 400 }
      )
    }

    const depRef = adminDb.collection(TRIPS_COLLECTION).doc(tripId)
      .collection(DEPARTURES_SUBCOLLECTION).doc(departureId)
    const depSnap = await depRef.get()

    if (!depSnap.exists) {
      throw new AppError('DEPARTURE_NOT_FOUND', 'Salida no encontrada', 404)
    }

    const depData = depSnap.data()
    const isOdooSynced = depData?.syncSource === 'odoo'

    // Odoo-synced departures: only isActive can be changed
    if (isOdooSynced && parsed.data.seatsMax !== undefined) {
      throw new AppError(
        'ODOO_FIELD_READONLY',
        'No se puede cambiar seatsMax en salidas sincronizadas de Odoo',
        400
      )
    }

    const updateData: Record<string, unknown> = {
      ...parsed.data,
      updatedAt: FieldValue.serverTimestamp(),
    }

    await depRef.update(updateData)

    return NextResponse.json({
      id: departureId,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
