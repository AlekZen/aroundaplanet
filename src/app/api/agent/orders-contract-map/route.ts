import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'

export const runtime = 'nodejs'

const ORDERS = 'orders'
const PAYMENTS = 'payments'

/**
 * NS-03 — GET /api/agent/orders-contract-map
 *
 * Retorna para cada orden Firestore vinculada al agente autenticado:
 *   - contractId (si la orden tiene un contrato generado)
 *   - verifiedPaymentIds[] con la fecha+monto para que el UI pueda
 *     mostrar la lista cuando hay múltiples recibos por orden
 *
 * Las órdenes Odoo legacy (vienen del endpoint XML-RPC, sin mirror en
 * Firestore) NO aparecen en el mapa — el UI muestra "Contrato pendiente"
 * para esos casos.
 */
export interface OrderActionEntry {
  contractId: string | null
  verifiedPayments: Array<{
    paymentId: string
    amountCents: number
    dateIso: string | null
  }>
}

export async function GET() {
  try {
    const claims = await requireAuth()
    const agentId = claims.agentId
    if (!agentId || typeof agentId !== 'string' || agentId.length === 0) {
      throw new AppError('FORBIDDEN', 'Requiere rol de agente', 403, false)
    }

    const [ordersSnap, paymentsSnap] = await Promise.all([
      adminDb.collection(ORDERS).where('agentId', '==', agentId).limit(500).get(),
      adminDb
        .collection(PAYMENTS)
        .where('agentId', '==', agentId)
        .where('status', '==', 'verified')
        .limit(500)
        .get(),
    ])

    const map: Record<string, OrderActionEntry> = {}

    for (const doc of ordersSnap.docs) {
      const data = doc.data()
      const contractId = typeof data.contractId === 'string' && data.contractId.length > 0 ? data.contractId : null
      map[doc.id] = { contractId, verifiedPayments: [] }
    }

    for (const doc of paymentsSnap.docs) {
      const data = doc.data()
      const orderId = typeof data.orderId === 'string' ? data.orderId : null
      if (!orderId) continue
      const entry = map[orderId] ?? { contractId: null, verifiedPayments: [] }
      const date = data.date
      const dateIso =
        date && typeof date === 'object' && 'toDate' in date
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (date as any).toDate().toISOString()
          : typeof date === 'string'
            ? date
            : null
      entry.verifiedPayments.push({
        paymentId: doc.id,
        amountCents: Number(data.amountCents ?? 0),
        dateIso,
      })
      map[orderId] = entry
    }

    // Orden estable: pagos por fecha descendente
    for (const orderId of Object.keys(map)) {
      map[orderId].verifiedPayments.sort((a, b) => (b.dateIso ?? '').localeCompare(a.dateIso ?? ''))
    }

    return NextResponse.json({ orders: map })
  } catch (error) {
    return handleApiError(error)
  }
}
