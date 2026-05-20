import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'

export const runtime = 'nodejs'

/**
 * Story 10.6 B1 — GET /api/admin/orders/orphan
 *
 * Lista órdenes sin `agentId` asignado, priorizando las que ya tienen
 * `contractId` o pagos verificados (donde la falta de agente es bloqueante
 * para que el agente vea recibo + contrato).
 *
 * Estructura del response:
 *   { orders: [...], total, withContract, withVerifiedPayment }
 */
export async function GET() {
  try {
    await requirePermission('orders:readAll')

    // Firestore no permite where('agentId', '==', null) confiable porque docs
    // sin el campo no matchean. Estrategia: traer órdenes (límite alto) y
    // filtrar en memoria por `agentId` ausente/null/vacío.
    const snap = await adminDb.collection('orders').limit(500).get()

    const orphans = snap.docs
      .map((doc) => {
        const d = doc.data()
        const agentId = d.agentId
        const hasAgent = typeof agentId === 'string' && agentId.length > 0
        if (hasAgent) return null
        return {
          orderId: doc.id,
          contactName: d.contactName ?? null,
          tripName: d.tripName ?? null,
          source: d.source ?? null,
          status: d.status ?? null,
          amountTotalCents: typeof d.amountTotalCents === 'number' ? d.amountTotalCents : 0,
          amountPaidCents: typeof d.amountPaidCents === 'number' ? d.amountPaidCents : 0,
          contractId: typeof d.contractId === 'string' && d.contractId.length > 0 ? d.contractId : null,
          createdAtIso: d.createdAt?.toDate?.()?.toISOString() ?? null,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    // Para cada orphan, contar pagos verified (en paralelo, cap por seguridad).
    const enriched = await Promise.all(
      orphans.map(async (o) => {
        const paymentsSnap = await adminDb
          .collection('payments')
          .where('orderId', '==', o.orderId)
          .where('status', '==', 'verified')
          .limit(20)
          .get()
        return {
          ...o,
          verifiedPaymentCount: paymentsSnap.size,
        }
      })
    )

    // Orden: primero los que tienen contrato + pagos verified (más urgentes)
    enriched.sort((a, b) => {
      const aPrio = (a.contractId ? 2 : 0) + (a.verifiedPaymentCount > 0 ? 1 : 0)
      const bPrio = (b.contractId ? 2 : 0) + (b.verifiedPaymentCount > 0 ? 1 : 0)
      if (aPrio !== bPrio) return bPrio - aPrio
      return (b.createdAtIso ?? '').localeCompare(a.createdAtIso ?? '')
    })

    const total = enriched.length
    const withContract = enriched.filter((o) => o.contractId).length
    const withVerifiedPayment = enriched.filter((o) => o.verifiedPaymentCount > 0).length

    return NextResponse.json({
      orders: enriched,
      total,
      withContract,
      withVerifiedPayment,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
