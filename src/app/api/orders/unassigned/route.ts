import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'

const ORDERS_COLLECTION = 'orders'
const TRIPS_COLLECTION = 'trips'

const UNASSIGNED_ORDER_FIELDS = [
  'contactName',
  'contactPhone',
  'tripId',
  'status',
  'amountTotalCents',
  'createdAt',
] as const

export async function GET() {
  try {
    await requirePermission('orders:readAll')

    const ordersSnap = await adminDb
      .collection(ORDERS_COLLECTION)
      .where('agentId', '==', null)
      .orderBy('createdAt', 'desc')
      .select(...UNASSIGNED_ORDER_FIELDS)
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
        contactName: d.contactName,
        contactPhone: d.contactPhone,
        tripName: tripNames[d.tripId] ?? 'Viaje no encontrado',
        status: d.status,
        amountTotalCents: d.amountTotalCents,
        createdAt: d.createdAt,
      }
    })

    return NextResponse.json({ orders, total: orders.length })
  } catch (error) {
    return handleApiError(error)
  }
}
