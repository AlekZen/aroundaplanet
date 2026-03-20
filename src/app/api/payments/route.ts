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

    const payments = docs.map((doc) => {
      const d = doc.data()
      return {
        id: doc.id,
        orderId: d.orderId ?? '',
        agentId: d.agentId ?? null,
        agentName: d.agentName ?? null,
        tripName: d.tripName ?? null,
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
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? null,
      }
    })

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

    // Get trip name for denormalization
    let tripName: string | null = null
    if (orderData.tripId) {
      const tripSnap = await adminDb.collection('trips').doc(orderData.tripId).get()
      tripName = tripSnap.data()?.odooName ?? null
    }

    // Get agent name if assigned
    let agentName: string | null = null
    if (orderData.agentId) {
      const agentSnap = await adminDb.collection('users').doc(orderData.agentId).get()
      const agentData = agentSnap.data()
      const fullName = `${agentData?.firstName ?? ''} ${agentData?.lastName ?? ''}`.trim()
      agentName = agentData?.displayName ?? (fullName || null)
    }

    const paymentData = {
      orderId,
      agentId: orderData.agentId ?? null,
      agentName,
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
