import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { tryAuth } from '@/lib/auth/tryAuth'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { createOrderSchema } from '@/schemas/orderSchema'

const TRIPS_COLLECTION = 'trips'
const DEPARTURES_SUBCOLLECTION = 'departures'
const ORDERS_COLLECTION = 'orders'
const GUEST_RATE_LIMIT_MAX = 5
const GUEST_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

export async function POST(request: NextRequest) {
  try {
    const claims = await tryAuth()

    const body = await request.json()
    const parsed = createOrderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos invalidos', retryable: false },
        { status: 400 }
      )
    }

    const { tripId, departureId, contactName, contactPhone, utmSource, utmMedium, utmCampaign, agentId: rawAgentId, agentContactId } = parsed.data

    // Validate agentId server-side: must be active user with 'agente' role
    let validatedAgentId: string | null = null
    if (rawAgentId) {
      const agentSnap = await adminDb.collection('users').doc(rawAgentId).get()
      if (agentSnap.exists) {
        const agentData = agentSnap.data()
        const isActiveAgent =
          agentData?.isActive === true &&
          Array.isArray(agentData?.roles) &&
          agentData.roles.includes('agente')
        if (isActiveAgent) {
          validatedAgentId = rawAgentId
        }
      }
    }

    // Rate limit for guest users (no auth)
    if (!claims) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      if (!ip) {
        throw new AppError('RATE_LIMITED', 'No se pudo identificar la solicitud', 429, true)
      }
      const oneHourAgo = new Date(Date.now() - GUEST_RATE_LIMIT_WINDOW_MS)
      const rateLimitQuery = adminDb
        .collection(ORDERS_COLLECTION)
        .where('userId', '==', null)
        .where('guestIp', '==', ip)
        .where('createdAt', '>=', oneHourAgo)
      const countSnap = await rateLimitQuery.count().get()

      if (countSnap.data().count >= GUEST_RATE_LIMIT_MAX) {
        throw new AppError('RATE_LIMITED', 'Demasiadas solicitudes — intenta mas tarde', 429, true)
      }
    }

    // Verify trip exists and is published
    const tripRef = adminDb.collection(TRIPS_COLLECTION).doc(tripId)
    const tripSnap = await tripRef.get()

    if (!tripSnap.exists || tripSnap.data()?.isPublished !== true) {
      throw new AppError('TRIP_NOT_FOUND', 'Viaje no encontrado o no publicado', 404)
    }

    // Verify departure exists, is active, and has seats (only if departureId provided)
    if (departureId) {
      const depRef = tripRef.collection(DEPARTURES_SUBCOLLECTION).doc(departureId)
      const depSnap = await depRef.get()

      if (!depSnap.exists || depSnap.data()?.isActive !== true) {
        throw new AppError('DEPARTURE_NOT_FOUND', 'Salida no encontrada o no activa', 404)
      }

      const depData = depSnap.data()!
      if ((depData.seatsAvailable ?? 0) <= 0) {
        throw new AppError('DEPARTURE_SOLD_OUT', 'Esta salida esta agotada', 409, true)
      }
    }

    // Read price server-side (NEVER trust client)
    const tripData = tripSnap.data()!
    const amountTotalCents = tripData.odooListPriceCentavos ?? 0

    if (!amountTotalCents || amountTotalCents <= 0) {
      throw new AppError('INVALID_PRICE', 'Precio del viaje no configurado', 500)
    }

    const guestToken = claims ? null : crypto.randomUUID()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    // Create order document
    const orderData = {
      userId: claims?.uid ?? null,
      guestToken,
      guestIp: claims ? null : ip,
      agentId: validatedAgentId,
      agentContactId: agentContactId ?? null,
      tripId,
      departureId: departureId ?? null,
      contactName,
      contactPhone: contactPhone ?? null,
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
        guestToken,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
