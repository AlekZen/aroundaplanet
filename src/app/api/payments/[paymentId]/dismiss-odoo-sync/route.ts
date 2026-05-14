/**
 * Story 9.6 — POST /api/payments/[paymentId]/dismiss-odoo-sync
 *
 * Descarta el sync Odoo de un pago (admin). Idempotente:
 * si ya está dismissed → 409.
 *
 * Body: { reason: string (min 5, max 500) }
 */
import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'

const PAYMENTS_COLLECTION = 'payments'

const dismissOdooSyncSchema = z.object({
  reason: z.string().min(5, 'El motivo debe tener al menos 5 caracteres').max(500),
})

interface RouteContext {
  params: Promise<{ paymentId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const claims = await requirePermission('payments:verify')
    const { paymentId } = await context.params

    const body = await request.json()
    const parsed = dismissOdooSyncSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Datos inválidos',
          retryable: false,
        },
        { status: 400 },
      )
    }

    const { reason } = parsed.data

    const ref = adminDb.collection(PAYMENTS_COLLECTION).doc(paymentId)
    const snap = await ref.get()
    if (!snap.exists) throw new AppError('PAYMENT_NOT_FOUND', 'Pago no encontrado', 404)

    const data = snap.data()!

    if (data.odooSyncStatus === 'dismissed') {
      throw new AppError(
        'ALREADY_DISMISSED',
        'El sync de este pago ya fue descartado previamente',
        409,
        false,
      )
    }

    await ref.update({
      odooSyncStatus: 'dismissed',
      odooSyncDismissedAt: FieldValue.serverTimestamp(),
      odooSyncDismissedBy: claims.uid,
      odooSyncDismissedReason: reason,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ dismissed: true })
  } catch (error) {
    return handleApiError(error)
  }
}
