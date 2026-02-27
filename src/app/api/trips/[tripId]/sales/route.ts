import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { fetchTripSales } from '@/lib/odoo/models/sales'

type RouteParams = { params: Promise<{ tripId: string }> }

/**
 * GET /api/trips/[tripId]/sales
 * Fetches sales orders from Odoo on-demand (not cached in Firestore).
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
      return NextResponse.json({ orders: [], summary: { totalOrders: 0, totalAmount: 0, totalPaid: 0, totalResidual: 0, byPaymentState: {} } })
    }

    const result = await fetchTripSales(odooProductId)
    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
