import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'

const TRIPS_COLLECTION = 'trips'
const ORDERS_COLLECTION = 'orders'
const PAYMENTS_COLLECTION = 'payments'

/**
 * GET /api/admin/stats — Dashboard KPIs for admin panel
 * Returns trip counts, order counts, payment counts, last sync timestamp
 */
export async function GET() {
  try {
    await requirePermission('trips:read')

    // Parallel queries for performance
    const [
      allTripsSnap,
      publishedTripsSnap,
      ordersSnap,
      unassignedOrdersSnap,
      pendingPaymentsSnap,
    ] = await Promise.all([
      adminDb.collection(TRIPS_COLLECTION).count().get(),
      adminDb.collection(TRIPS_COLLECTION).where('isPublished', '==', true).count().get(),
      adminDb.collection(ORDERS_COLLECTION).count().get(),
      adminDb.collection(ORDERS_COLLECTION).where('agentId', '==', null).count().get(),
      adminDb.collection(PAYMENTS_COLLECTION).where('status', '==', 'pending_verification').count().get()
        .catch(() => ({ data: () => ({ count: 0 }) })),
    ])

    // Last sync: get the most recently synced trip
    const lastSyncSnap = await adminDb.collection(TRIPS_COLLECTION)
      .orderBy('lastSyncAt', 'desc')
      .limit(1)
      .select('lastSyncAt')
      .get()

    let lastSyncAt: string | null = null
    if (!lastSyncSnap.empty) {
      const syncTs = lastSyncSnap.docs[0].data().lastSyncAt
      if (syncTs?.toDate) {
        lastSyncAt = syncTs.toDate().toISOString()
      }
    }

    return NextResponse.json({
      totalTrips: allTripsSnap.data().count,
      publishedTrips: publishedTripsSnap.data().count,
      totalOrders: ordersSnap.data().count,
      unassignedOrders: unassignedOrdersSnap.data().count,
      pendingPayments: pendingPaymentsSnap.data().count,
      lastSyncAt,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
