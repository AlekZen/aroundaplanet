/**
 * Story 9.6 — POST /api/payments/[paymentId]/retry-odoo-push
 *
 * Reintenta push Firestore→Odoo para pagos en cola (pending/error).
 * No reintenta dismissed (409). Idempotente via patrón invertido 9.0b.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { syncVerifiedPaymentToOdoo } from '@/lib/odoo/payments-push'

const PAYMENTS_COLLECTION = 'payments'

interface RouteContext {
  params: Promise<{ paymentId: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    await requirePermission('payments:verify')
    const { paymentId } = await context.params

    const ref = adminDb.collection(PAYMENTS_COLLECTION).doc(paymentId)
    const snap = await ref.get()
    if (!snap.exists) throw new AppError('PAYMENT_NOT_FOUND', 'Pago no encontrado', 404)

    const data = snap.data()!

    if (data.odooSyncStatus === 'dismissed') {
      throw new AppError(
        'SYNC_DISMISSED',
        'El sync fue descartado manualmente. Usa la opción "Reactivar" antes de reintentar.',
        409,
        false,
      )
    }

    const result = await syncVerifiedPaymentToOdoo(paymentId, data)

    if (result.status === 'error') {
      return NextResponse.json(
        {
          ok: false,
          error: result.error ?? 'Error desconocido en push a Odoo',
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      odooPaymentId: result.odooPaymentId ?? null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
