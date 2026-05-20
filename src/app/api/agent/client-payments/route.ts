import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'

export const runtime = 'nodejs'

const PAYMENTS_COLLECTION = 'payments'
const USERS_COLLECTION = 'users'
const TRIPS_COLLECTION = 'trips'
const ORDERS_COLLECTION = 'orders'

/**
 * Story 10.6 AC3 — GET /api/agent/client-payments
 *
 * Devuelve pagos verified cuyo `agentId` coincide con el agente autenticado.
 * El campo `agentId` del pago se denormaliza al momento del verify (Story 10.6
 * AC2) desde `orders/{orderId}.agentId`. Si la orden no tiene agentId asignado,
 * el admin debe asignarlo desde el banner en `/admin/orders/[orderId]` (AC5).
 *
 * Los receipts son objetos públicos en Storage (`payments/upload` hace
 * `makePublic`), por lo que `receiptUrl` es directamente la URL pública sin
 * necesidad de firmar.
 */
export async function GET() {
  try {
    const claims = await requireAuth()
    const agentId = claims.agentId
    if (!agentId || typeof agentId !== 'string' || agentId.length === 0) {
      throw new AppError('FORBIDDEN', 'Requiere rol de agente', 403, false)
    }

    const snap = await adminDb
      .collection(PAYMENTS_COLLECTION)
      .where('agentId', '==', agentId)
      .where('status', '==', 'verified')
      .limit(200)
      .get()

    // Cache de enrichment intra-request
    const clientNameCache = new Map<string, string | null>()
    const tripNameCache = new Map<string, string | null>()
    const orderContactNameCache = new Map<string, string | null>()

    async function getTripName(tripId: string | null | undefined): Promise<string | null> {
      if (!tripId) return null
      if (tripNameCache.has(tripId)) return tripNameCache.get(tripId)!
      const tripSnap = await adminDb.collection(TRIPS_COLLECTION).doc(tripId).get()
      const name = tripSnap.data()?.odooName ?? tripSnap.data()?.name ?? null
      tripNameCache.set(tripId, name)
      return name
    }

    async function getClientName(clientUid: string | null | undefined): Promise<string | null> {
      if (!clientUid) return null
      if (clientNameCache.has(clientUid)) return clientNameCache.get(clientUid)!
      const userSnap = await adminDb.collection(USERS_COLLECTION).doc(clientUid).get()
      const u = userSnap.data()
      if (!u) {
        clientNameCache.set(clientUid, null)
        return null
      }
      const fullName = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
      const name = u.displayName ?? (fullName || null)
      clientNameCache.set(clientUid, name)
      return name
    }

    async function getOrderContactName(orderId: string | null | undefined): Promise<string | null> {
      if (!orderId) return null
      if (orderContactNameCache.has(orderId)) return orderContactNameCache.get(orderId)!
      const orderSnap = await adminDb.collection(ORDERS_COLLECTION).doc(orderId).get()
      const name = orderSnap.data()?.contactName ?? null
      orderContactNameCache.set(orderId, name)
      return name
    }

    const items = await Promise.all(
      snap.docs.map(async (doc) => {
        const d = doc.data()
        const tripName = d.tripName ?? (await getTripName(d.tripId))
        // clientName prioridad: campo denormalizado → users/{clientId}.displayName → orders/{orderId}.contactName
        let clientName: string | null = typeof d.clientName === 'string' && d.clientName.length > 0
          ? d.clientName
          : null
        if (!clientName) clientName = await getClientName(d.clientId)
        if (!clientName) clientName = await getOrderContactName(d.orderId)

        return {
          id: doc.id,
          orderId: typeof d.orderId === 'string' ? d.orderId : '',
          tripName,
          clientName,
          amountCents: typeof d.amountCents === 'number' ? d.amountCents : 0,
          paymentMethod: d.paymentMethod ?? 'transfer',
          bankName: d.bankName ?? null,
          bankReference: d.bankReference ?? null,
          receiptUrl: d.receiptUrl ?? null,
          verifiedAt: d.verifiedAt?.toDate?.()?.toISOString() ?? null,
          createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
        }
      })
    )

    items.sort((a, b) => {
      if (a.verifiedAt && b.verifiedAt) return b.verifiedAt.localeCompare(a.verifiedAt)
      if (a.verifiedAt) return -1
      if (b.verifiedAt) return 1
      return 0
    })

    return NextResponse.json({ payments: items, total: items.length })
  } catch (error) {
    return handleApiError(error)
  }
}
