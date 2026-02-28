import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { createOrderSchema } from '@/schemas/orderSchema'

const TRIPS_COLLECTION = 'trips'
const DEPARTURES_SUBCOLLECTION = 'departures'
const ORDERS_COLLECTION = 'orders'

export async function POST(request: NextRequest) {
  try {
    const claims = await requireAuth()

    const body = await request.json()
    const parsed = createOrderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos invalidos', retryable: false },
        { status: 400 }
      )
    }

    const { tripId, departureId, contactName, contactPhone, utmSource, utmMedium, utmCampaign, agentId } = parsed.data

    // Verify trip exists and is published
    const tripRef = adminDb.collection(TRIPS_COLLECTION).doc(tripId)
    const tripSnap = await tripRef.get()

    if (!tripSnap.exists || tripSnap.data()?.isPublished !== true) {
      throw new AppError('TRIP_NOT_FOUND', 'Viaje no encontrado o no publicado', 404)
    }

    // Verify departure exists, is active, and has seats
    const depRef = tripRef.collection(DEPARTURES_SUBCOLLECTION).doc(departureId)
    const depSnap = await depRef.get()

    if (!depSnap.exists || depSnap.data()?.isActive !== true) {
      throw new AppError('DEPARTURE_NOT_FOUND', 'Salida no encontrada o no activa', 404)
    }

    const depData = depSnap.data()!
    if ((depData.seatsAvailable ?? 0) <= 0) {
      throw new AppError('DEPARTURE_SOLD_OUT', 'Esta salida esta agotada', 409, true)
    }

    // Read price server-side (NEVER trust client)
    const tripData = tripSnap.data()!
    const amountTotalCents = tripData.odooListPriceCentavos ?? 0

    // Create order document
    const orderData = {
      userId: claims.uid,
      agentId: agentId ?? null,
      tripId,
      departureId,
      contactName,
      contactPhone,
      status: 'Interesado' as const,
      amountTotalCents,
      amountPaidCents: 0,
      utmSource: utmSource ?? null,
      utmMedium: utmMedium ?? null,
      utmCampaign: utmCampaign ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    const docRef = await adminDb.collection(ORDERS_COLLECTION).add(orderData)

    return NextResponse.json(
      {
        orderId: docRef.id,
        status: 'Interesado',
        tripId,
        departureId,
        amountTotalCents,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
