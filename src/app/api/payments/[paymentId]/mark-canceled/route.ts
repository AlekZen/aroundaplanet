import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'

const markCanceledBodySchema = z.object({
  alertId: z.string().min(1),
  note: z.string().max(500).optional(),
})

interface RouteContext {
  params: Promise<{ paymentId: string }>
}

/**
 * POST /api/payments/[paymentId]/mark-canceled
 * Marca un pago Firestore como rejected para reflejar que fue cancelado en Odoo.
 * Resuelve la alerta odoo_canceled asociada y deja log de auditoría.
 * Requiere permiso payments:verify (admin/superadmin).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const claims = await requirePermission('payments:verify')
    const { paymentId } = await context.params

    const body = await request.json()
    const parsed = markCanceledBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos inválidos', retryable: false },
        { status: 400 },
      )
    }

    const { alertId, note } = parsed.data

    // Verificar que la alerta existe y es de tipo odoo_canceled
    const alertRef = adminDb.collection('paymentAlerts').doc(alertId)
    const alertSnap = await alertRef.get()

    if (!alertSnap.exists) {
      return NextResponse.json({ code: 'invalid_alert', message: 'Alerta no encontrada' }, { status: 400 })
    }

    const alertData = alertSnap.data()!
    if (alertData.type !== 'odoo_canceled') {
      return NextResponse.json(
        { code: 'invalid_alert', message: `La alerta no es de tipo odoo_canceled (type=${alertData.type})` },
        { status: 400 },
      )
    }

    const paymentRef = adminDb.collection('payments').doc(paymentId)
    const paymentSnap = await paymentRef.get()

    if (!paymentSnap.exists) {
      throw new AppError('PAYMENT_NOT_FOUND', 'Pago no encontrado', 404)
    }

    const ms = Date.now()
    const logRef = adminDb.collection('syncLog').doc(`alertResolved-${alertId}-${ms}`)

    await adminDb.runTransaction(async (tx) => {
      tx.update(paymentRef, {
        status: 'rejected',
        rejectionReason: `cancelled_in_odoo: ${note ?? ''}`,
        rejectedBy: claims.uid,
        rejectedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

      tx.update(alertRef, {
        status: 'resolved',
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: claims.uid,
        resolutionNote: `firestore_canceled_to_match_odoo: ${note ?? ''}`,
      })

      tx.set(logRef, {
        alertId,
        paymentId,
        action: 'firestore_canceled',
        resolvedBy: claims.uid,
        timestamp: FieldValue.serverTimestamp(),
      })
    })

    return NextResponse.json({ markedCanceled: true })
  } catch (error) {
    return handleApiError(error)
  }
}
