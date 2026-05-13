import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { createPaymentSchema, paymentListQuerySchema } from '@/schemas/paymentSchema'

const PAYMENTS_COLLECTION = 'payments'
const ORDERS_COLLECTION = 'orders'
const USERS_COLLECTION = 'users'
const ODOO_AGENTS_COLLECTION = 'odooAgents'
const TRIPS_COLLECTION = 'trips'

/** Resolve agent display name from users/{agentId} or fallback to odooAgents/{agentId}. */
async function resolveAgentName(agentId: string | null | undefined): Promise<string | null> {
  if (!agentId) return null
  const userSnap = await adminDb.collection(USERS_COLLECTION).doc(agentId).get()
  if (userSnap.exists) {
    const u = userSnap.data()!
    const fullName = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
    const resolved = u.displayName ?? (fullName || null)
    if (resolved) return resolved
  }
  const odooSnap = await adminDb.collection(ODOO_AGENTS_COLLECTION).doc(agentId).get()
  if (odooSnap.exists) {
    return odooSnap.data()?.name ?? null
  }
  return null
}

/** Resolve trip name from trips/{tripId}.odooName. */
async function resolveTripName(tripId: string | null | undefined): Promise<string | null> {
  if (!tripId) return null
  const tripSnap = await adminDb.collection(TRIPS_COLLECTION).doc(tripId).get()
  return tripSnap.data()?.odooName ?? null
}

/**
 * GET /api/payments — List payments for admin verification queue
 * Query params: status, pageSize, cursor
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission('payments:readAll')

    const { searchParams } = request.nextUrl
    const parsed = paymentListQuerySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Parametros invalidos', retryable: false },
        { status: 400 }
      )
    }

    const { status, pageSize, cursor } = parsed.data

    let query: FirebaseFirestore.Query = adminDb.collection(PAYMENTS_COLLECTION)
      .orderBy('createdAt', 'desc')

    if (status) {
      query = query.where('status', '==', status)
    }

    if (cursor) {
      const cursorDoc = await adminDb.collection(PAYMENTS_COLLECTION).doc(cursor).get()
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc)
      }
    }

    query = query.limit(pageSize + 1)

    const snapshot = await query.get()
    const docs = snapshot.docs.slice(0, pageSize)
    const hasMore = snapshot.docs.length > pageSize
    const nextCursor = hasMore ? docs[docs.length - 1]?.id ?? null : null

    // Lazy-enrich: collect orderIds that need fallback resolution
    const orderIdsToFetch = new Set<string>()
    for (const doc of docs) {
      const d = doc.data()
      const needsClient = !d.clientName
      const needsAgent = !d.agentName && d.agentId
      const needsTrip = !d.tripName
      if ((needsClient || needsAgent || needsTrip) && d.orderId) {
        orderIdsToFetch.add(d.orderId)
      }
    }

    const orderCache = new Map<string, FirebaseFirestore.DocumentData>()
    if (orderIdsToFetch.size > 0) {
      const orderSnaps = await Promise.all(
        Array.from(orderIdsToFetch).map((id) =>
          adminDb.collection(ORDERS_COLLECTION).doc(id).get()
        )
      )
      for (const snap of orderSnaps) {
        if (snap.exists) orderCache.set(snap.id, snap.data()!)
      }
    }

    const agentNameCache = new Map<string, string | null>()
    const tripNameCache = new Map<string, string | null>()

    const payments = await Promise.all(docs.map(async (doc) => {
      const d = doc.data()
      const order = d.orderId ? orderCache.get(d.orderId) : undefined

      // Resolve client (from doc, else from order)
      const clientId = d.clientId ?? order?.userId ?? null
      const clientName = d.clientName ?? order?.contactName ?? null
      const clientPhone = d.clientPhone ?? order?.contactPhone ?? null

      // Resolve agent name with fallbacks
      let agentName: string | null = d.agentName ?? null
      const resolvedAgentId = d.agentId ?? order?.agentId ?? null
      if (!agentName && resolvedAgentId) {
        if (agentNameCache.has(resolvedAgentId)) {
          agentName = agentNameCache.get(resolvedAgentId) ?? null
        } else {
          agentName = await resolveAgentName(resolvedAgentId)
          agentNameCache.set(resolvedAgentId, agentName)
        }
      }

      // Resolve trip name
      let tripName: string | null = d.tripName ?? null
      const resolvedTripId = order?.tripId ?? null
      if (!tripName && resolvedTripId) {
        if (tripNameCache.has(resolvedTripId)) {
          tripName = tripNameCache.get(resolvedTripId) ?? null
        } else {
          tripName = await resolveTripName(resolvedTripId)
          tripNameCache.set(resolvedTripId, tripName)
        }
      }

      return {
        id: doc.id,
        orderId: d.orderId ?? '',
        agentId: resolvedAgentId,
        agentName,
        clientId,
        clientName,
        clientPhone,
        tripName,
        amountCents: d.amountCents ?? 0,
        paymentMethod: d.paymentMethod ?? 'transfer',
        date: d.date?.toDate?.()?.toISOString() ?? d.date ?? null,
        registeredBy: d.registeredBy ?? '',
        registeredByName: d.registeredByName ?? null,
        receiptUrl: d.receiptUrl ?? null,
        bankName: d.bankName ?? null,
        bankReference: d.bankReference ?? null,
        beneficiaryName: d.beneficiaryName ?? null,
        concept: d.concept ?? null,
        sourceAccount: d.sourceAccount ?? null,
        destinationAccount: d.destinationAccount ?? null,
        status: d.status ?? 'pending_verification',
        verifiedBy: d.verifiedBy ?? null,
        verifiedAt: d.verifiedAt?.toDate?.()?.toISOString() ?? null,
        rejectionNote: d.rejectionNote ?? null,
        notes: d.notes ?? null,
        syncedToOdoo: d.syncedToOdoo ?? false,
        odooPaymentId: d.odooPaymentId ?? null,
        odooSyncStatus: d.odooSyncStatus ?? null,
        odooJournalName: d.odooJournalName ?? null,
        odooLastError: d.odooLastError ?? null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? null,
      }
    }))

    return NextResponse.json({ payments, nextCursor })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/payments — Register a new payment (agent or client)
 */
export async function POST(request: NextRequest) {
  try {
    const claims = await requireAuth()

    const body = await request.json()
    const parsed = createPaymentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos invalidos', retryable: false },
        { status: 400 }
      )
    }

    const { orderId, amountCents, paymentMethod, date, receiptUrl, bankName, bankReference, beneficiaryName, concept, sourceAccount, destinationAccount, notes } = parsed.data

    // Duplicate detection: check if a payment with the same bankReference already exists
    if (bankReference) {
      const duplicateSnap = await adminDb.collection(PAYMENTS_COLLECTION)
        .where('bankReference', '==', bankReference)
        .limit(1)
        .get()

      if (!duplicateSnap.empty) {
        throw new AppError(
          'DUPLICATE_REFERENCE',
          `Ya existe un pago registrado con la referencia ${bankReference}. Verifica que no sea un comprobante duplicado.`,
          409,
          false
        )
      }
    }

    // Verify order exists
    const orderSnap = await adminDb.collection(ORDERS_COLLECTION).doc(orderId).get()
    if (!orderSnap.exists) {
      throw new AppError('ORDER_NOT_FOUND', 'Orden no encontrada', 404)
    }

    const orderData = orderSnap.data()!

    // Agent isolation: agentes only report for their own orders
    const userRoles: string[] = claims.roles ?? []
    const isAdmin = userRoles.includes('admin') || userRoles.includes('superadmin')
    if (!isAdmin && orderData.agentId !== claims.uid && orderData.userId !== claims.uid) {
      throw new AppError('FORBIDDEN', 'No tienes acceso a esta orden', 403)
    }

    // Get user profile for registeredByName
    const userSnap = await adminDb.collection('users').doc(claims.uid).get()
    const userData = userSnap.data()
    const fullUserName = `${userData?.firstName ?? ''} ${userData?.lastName ?? ''}`.trim()
    const registeredByName = userData?.displayName ?? (fullUserName || claims.uid)

    // Denormalize names for the verification queue
    const tripName = await resolveTripName(orderData.tripId)
    const agentName = await resolveAgentName(orderData.agentId)

    const paymentData = {
      orderId,
      agentId: orderData.agentId ?? null,
      agentName,
      clientId: orderData.userId ?? null,
      clientName: orderData.contactName ?? null,
      clientPhone: orderData.contactPhone ?? null,
      tripName,
      amountCents,
      paymentMethod,
      date: new Date(date),
      registeredBy: claims.uid,
      registeredByName,
      receiptUrl: receiptUrl ?? null,
      bankName: bankName ?? null,
      bankReference: bankReference ?? null,
      beneficiaryName: beneficiaryName ?? null,
      concept: concept ?? null,
      sourceAccount: sourceAccount ?? null,
      destinationAccount: destinationAccount ?? null,
      status: 'pending_verification' as const,
      verifiedBy: null,
      verifiedAt: null,
      rejectionNote: null,
      notes: notes ?? null,
      ocrResult: null,
      syncedToOdoo: false,
      odooPaymentId: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    const docRef = await adminDb.collection(PAYMENTS_COLLECTION).add(paymentData)

    return NextResponse.json(
      {
        paymentId: docRef.id,
        status: 'pending_verification',
        orderId,
        amountCents,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
