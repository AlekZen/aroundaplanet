import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'
import { PaymentReceiptDocument, type PaymentReceiptSnapshot } from '@/lib/pdf/templates/PaymentReceiptDocument'
import { currencyToSpanish, formatMxnFromCents } from '@/lib/pdf/currencyToSpanish'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/schemas/paymentSchema'

export const runtime = 'nodejs'

const PAYMENTS = 'payments'
const ORDERS = 'orders'
const TRIPS = 'trips'
const USERS = 'users'

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (value as any).toDate()
    } catch {
      return null
    }
  }
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function formatDateEs(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
}

interface PaymentDoc {
  paymentId: string
  orderId: string | null
  agentId: string | null
  clientId: string | null
  registeredBy: string | null
  clientName: string | null
  clientPhone: string | null
  status: string
  amountCents: number
  paymentMethod: PaymentMethod
  bankName: string | null
  bankReference: string | null
  date: Date | null
  verifiedAt: Date | null
}

async function loadPayment(paymentId: string): Promise<PaymentDoc | null> {
  const snap = await adminDb.collection(PAYMENTS).doc(paymentId).get()
  if (!snap.exists) return null
  const d = snap.data()!
  return {
    paymentId: snap.id,
    orderId: typeof d.orderId === 'string' ? d.orderId : null,
    agentId: typeof d.agentId === 'string' ? d.agentId : null,
    clientId: typeof d.clientId === 'string' ? d.clientId : null,
    registeredBy: typeof d.registeredBy === 'string' ? d.registeredBy : null,
    clientName: typeof d.clientName === 'string' ? d.clientName : null,
    clientPhone: typeof d.clientPhone === 'string' ? d.clientPhone : null,
    status: typeof d.status === 'string' ? d.status : 'pending_verification',
    amountCents: Number(d.amountCents ?? 0),
    paymentMethod: (d.paymentMethod ?? 'transfer') as PaymentMethod,
    bankName: typeof d.bankName === 'string' ? d.bankName : null,
    bankReference: typeof d.bankReference === 'string' ? d.bankReference : null,
    date: toDateOrNull(d.date),
    verifiedAt: toDateOrNull(d.verifiedAt),
  }
}

async function computeCobradoAcumulado(orderId: string, upToDate: Date | null): Promise<number> {
  const snap = await adminDb
    .collection(PAYMENTS)
    .where('orderId', '==', orderId)
    .where('status', '==', 'verified')
    .get()
  let total = 0
  const cutoff = upToDate?.getTime() ?? Infinity
  for (const doc of snap.docs) {
    const data = doc.data()
    const d = toDateOrNull(data.date)
    const t = d?.getTime() ?? 0
    if (t <= cutoff) {
      total += Number(data.amountCents ?? 0)
    }
  }
  return total
}

async function resolveClientName(payment: PaymentDoc, orderData: Record<string, unknown> | null): Promise<string | null> {
  if (payment.clientName && payment.clientName.trim()) return payment.clientName
  if (payment.clientId) {
    const userSnap = await adminDb.collection(USERS).doc(payment.clientId).get()
    const u = userSnap.data()
    if (u) {
      const display = typeof u.displayName === 'string' ? u.displayName : null
      const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
      const name = display ?? (full.length > 0 ? full : null)
      if (name) return name
    }
  }
  if (orderData && typeof orderData.contactName === 'string' && orderData.contactName.trim().length > 0) {
    return orderData.contactName
  }
  return null
}

interface RouteContext {
  params: Promise<{ paymentId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const claims = await requireAuth()
    const { paymentId } = await context.params

    const payment = await loadPayment(paymentId)
    if (!payment) {
      throw new AppError('PAYMENT_NOT_FOUND', 'Pago no encontrado', 404, false)
    }

    const isAdmin = claims.roles.includes('admin') || claims.roles.includes('superadmin')
    const isAgentMatch = !!claims.agentId && payment.agentId === claims.agentId
    const isClientMatch =
      (payment.clientId !== null && payment.clientId === claims.uid) ||
      (payment.registeredBy !== null && payment.registeredBy === claims.uid)

    if (!isAdmin && !isAgentMatch && !isClientMatch) {
      throw new AppError('FORBIDDEN', 'No tienes permiso para descargar este recibo', 403, false)
    }

    if (payment.status !== 'verified') {
      throw new AppError(
        'RECEIPT_NOT_AVAILABLE',
        'El recibo se genera una vez que admin verifica el pago',
        409,
        false
      )
    }

    let orderTotalCents = 0
    let tripName: string | null = null
    let orderData: Record<string, unknown> | null = null
    if (payment.orderId) {
      const orderSnap = await adminDb.collection(ORDERS).doc(payment.orderId).get()
      orderData = orderSnap.exists ? (orderSnap.data() as Record<string, unknown>) : null
      if (orderData) {
        orderTotalCents = Number(orderData.amountTotalCents ?? 0)
        const tripId = typeof orderData.tripId === 'string' ? orderData.tripId : null
        if (tripId) {
          const tripSnap = await adminDb.collection(TRIPS).doc(tripId).get()
          const td = tripSnap.data()
          tripName = td?.odooName ?? td?.name ?? null
        }
      }
    }

    const cobradoAcumuladoCents = payment.orderId
      ? await computeCobradoAcumulado(payment.orderId, payment.date)
      : payment.amountCents
    const saldoPendienteCents = Math.max(orderTotalCents - cobradoAcumuladoCents, 0)

    const clientName = await resolveClientName(payment, orderData)
    const receiptNumber = `R-${payment.paymentId.slice(0, 8)}-V1`
    const generatedAt = new Date()

    const snapshot: PaymentReceiptSnapshot = {
      receiptNumber,
      clientName,
      clientPhone: payment.clientPhone,
      tripName,
      paymentAmountFormatted: formatMxnFromCents(payment.amountCents),
      paymentAmountLetras: currencyToSpanish(payment.amountCents),
      paymentDateFormatted: formatDateEs(payment.date),
      verifiedAtFormatted: formatDateEs(payment.verifiedAt),
      paymentMethodLabel: PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod,
      bankName: payment.bankName,
      bankReference: payment.bankReference,
      orderTotalFormatted: formatMxnFromCents(orderTotalCents),
      cobradoAcumuladoFormatted: formatMxnFromCents(cobradoAcumuladoCents),
      saldoPendienteFormatted: formatMxnFromCents(saldoPendienteCents),
      generatedAtFormatted: formatDateEs(generatedAt),
    }

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(PaymentReceiptDocument, { snapshot }) as any
    )

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="recibo-${receiptNumber}.pdf"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
