import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { fetchTripSales } from '@/lib/odoo/models/sales'
import { withCacheFallback } from '@/lib/odoo/cache'

type RouteParams = { params: Promise<{ tripId: string }> }

const EMPTY_SALES = { orders: [], summary: { totalOrders: 0, totalAmount: 0, totalPaid: 0, totalResidual: 0, byPaymentState: {} } }

/**
 * GET /api/trips/[tripId]/sales
 * Fetches sales orders from Odoo with Firestore cache (1h TTL).
 * Requires trips:read permission.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission('trips:read')
    const { tripId } = await params

    // Get trip to find odooProductId
    const tripSnap = await adminDb.collection('trips').doc(tripId).get()
    if (!tripSnap.exists) {
      throw new AppError('TRIP_NOT_FOUND', 'Viaje no encontrado', 404)
    }

    const tripData = tripSnap.data()
    const odooProductId = tripData?.odooProductId as number | undefined

    if (!odooProductId) {
      return NextResponse.json(EMPTY_SALES)
    }

    // Cache key by product ID — TTL governed by sale.order config (1h)
    const cached = await withCacheFallback(
      'sale.order',
      `trip-sales-${odooProductId}`,
      () => fetchTripSales(odooProductId),
    )

    return NextResponse.json(cached.data)
  } catch (error) {
    return handleApiError(error)
  }
}
