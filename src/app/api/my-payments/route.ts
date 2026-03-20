import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/handleApiError'

const PAYMENTS_COLLECTION = 'payments'

/**
 * GET /api/my-payments — Returns payments registered by the authenticated user
 * Used by agents to see their payment statuses and by clients to track their own
 */
export async function GET() {
  try {
    const claims = await requireAuth()

    const paymentsSnap = await adminDb
      .collection(PAYMENTS_COLLECTION)
      .where('registeredBy', '==', claims.uid)
      .orderBy('createdAt', 'desc')
      .get()

    const payments = paymentsSnap.docs.map((doc) => {
      const d = doc.data()
      return {
        id: doc.id,
        orderId: d.orderId ?? '',
        tripName: d.tripName ?? null,
        amountCents: d.amountCents ?? 0,
        paymentMethod: d.paymentMethod ?? 'transfer',
        bankName: d.bankName ?? null,
        bankReference: d.bankReference ?? null,
        beneficiaryName: d.beneficiaryName ?? null,
        concept: d.concept ?? null,
        sourceAccount: d.sourceAccount ?? null,
        destinationAccount: d.destinationAccount ?? null,
        receiptUrl: d.receiptUrl ?? null,
        status: d.status ?? 'pending_verification',
        rejectionNote: d.rejectionNote ?? null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
        verifiedAt: d.verifiedAt?.toDate?.()?.toISOString() ?? null,
      }
    })

    return NextResponse.json({ payments, total: payments.length })
  } catch (error) {
    return handleApiError(error)
  }
}
