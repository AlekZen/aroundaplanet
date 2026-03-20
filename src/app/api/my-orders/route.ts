import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/handleApiError'

const ORDERS_COLLECTION = 'orders'
const TRIPS_COLLECTION = 'trips'

const ORDER_LIST_FIELDS = [
  'contactName',
  'tripId',
  'status',
  'createdAt',
  'amountTotalCents',
  'amountPaidCents',
  'agentId',
] as const

/**
 * GET /api/my-orders — Returns orders belonging to the authenticated user
 */
export async function GET() {
  try {
    const claims = await requireAuth()

    const ordersSnap = await adminDb
      .collection(ORDERS_COLLECTION)
      .where('userId', '==', claims.uid)
      .orderBy('createdAt', 'desc')
      .select(...ORDER_LIST_FIELDS)
      .get()

    // Batch-fetch trip names
    const tripIds = [...new Set(ordersSnap.docs.map((d) => d.data().tripId as string))]
    const tripNames: Record<string, string> = {}
    if (tripIds.length > 0) {
      const tripSnaps = await Promise.all(
        tripIds.map((id) => adminDb.collection(TRIPS_COLLECTION).doc(id).get())
      )
      for (const snap of tripSnaps) {
        if (snap.exists) {
          tripNames[snap.id] = (snap.data()?.odooName as string) ?? 'Viaje sin nombre'
        }
      }
    }

    const orders = ordersSnap.docs.map((doc) => {
      const d = doc.data()
      return {
        id: doc.id,
        contactName: d.contactName ?? '',
        tripName: tripNames[d.tripId] ?? 'Viaje no encontrado',
        status: d.status ?? 'Interesado',
        amountTotalCents: d.amountTotalCents ?? 0,
        amountPaidCents: d.amountPaidCents ?? 0,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
      }
    })

    return NextResponse.json({ orders, total: orders.length })
  } catch (error) {
    return handleApiError(error)
  }
}
