import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'

const ORDERS_COLLECTION = 'orders'
const TRIPS_COLLECTION = 'trips'

const ORDER_LIST_FIELDS = [
  'contactName',
  'tripId',
  'status',
  'createdAt',
  'amountTotalCents',
] as const

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const claims = await requireAuth()
    const { agentId } = await params

    // Agent isolation: agent can ONLY see their own orders
    if (claims.agentId !== agentId) {
      throw new AppError('INSUFFICIENT_PERMISSION', 'Solo puedes ver tus propios leads', 403, false)
    }

    const ordersSnap = await adminDb
      .collection(ORDERS_COLLECTION)
      .where('agentId', '==', agentId)
      .orderBy('createdAt', 'desc')
      .select(...ORDER_LIST_FIELDS)
      .get()

    // Batch-fetch trip names for display
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
