/**
 * Story 9.2 — POST /api/payments/[paymentId]/retry-sync
 *
 * Reintenta push Firestore→Odoo para un pago en `odooSyncStatus in
 * ('error', 'orphan', 'pending')`. NO toca pagos `legacy_linked` (read-only)
 * ni `synced` (idempotente, ya completado).
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

    if (data.status !== 'verified') {
      throw new AppError(
        'INVALID_STATE',
        `Solo se puede reintentar sync de pagos verificados (actual: "${data.status}")`,
        409,
        false,
      )
    }

    const syncStatus = data.odooSyncStatus
    if (syncStatus === 'synced' || syncStatus === 'legacy_linked') {
      throw new AppError(
        'ALREADY_SYNCED',
        `Pago ya sincronizado (odooSyncStatus="${syncStatus}")`,
        409,
        false,
      )
    }
    // Permitidos: 'error', 'orphan', 'pending', null/undefined (never_synced legacy)
    const allowed = new Set(['error', 'orphan', 'pending', undefined, null, 'never_synced'])
    if (!allowed.has(syncStatus)) {
      throw new AppError(
        'INVALID_STATE',
        `No se puede reintentar sync con odooSyncStatus="${syncStatus}"`,
        409,
        false,
      )
    }

    const result = await syncVerifiedPaymentToOdoo(paymentId, data)

    return NextResponse.json({
      paymentId,
      odooPaymentId: result.odooPaymentId ?? null,
      status: result.status,
      error: result.error,
      isNew: result.isNew,
      orphan: result.orphan,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
