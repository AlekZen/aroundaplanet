import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'

const DEFAULT_COMMISSION_RATE = 0.10

/**
 * Creates a commission document when a payment is verified.
 * Idempotent via deterministic doc ID: `comm_{paymentId}` — set() with merge prevents duplicates
 * even under concurrent calls (F-01 fix). Fire-and-forget: caller catches errors.
 */
export async function createCommissionFromPayment(
  paymentId: string,
  paymentData: Record<string, unknown>
): Promise<void> {
  const agentId = typeof paymentData.agentId === 'string' ? paymentData.agentId : null
  if (!agentId) return

  const amountCents = typeof paymentData.amountCents === 'number' ? paymentData.amountCents : null
  if (!amountCents || amountCents <= 0) return

  // Read agent doc for commissionRate with Zod-style validation (F-04)
  const agentDoc = await adminDb.doc(`agents/${agentId}`).get()
  const rawRate = agentDoc.exists ? agentDoc.data()?.commissionRate : null
  const commissionRate = typeof rawRate === 'number' ? rawRate : DEFAULT_COMMISSION_RATE

  if (commissionRate <= 0 || commissionRate > 1) {
    console.warn(`[Commission Hook] Invalid commissionRate=${commissionRate} for agentId=${agentId}, skipping`)
    return
  }

  const commissionAmountCents = Math.round(amountCents * commissionRate)

  // Period from payment date (F-08: handle both string and Timestamp)
  let period: string
  const paymentDate = paymentData.date
  if (typeof paymentDate === 'string' && /^\d{4}-\d{2}/.test(paymentDate)) {
    period = paymentDate.substring(0, 7)
  } else if (paymentDate && typeof paymentDate === 'object' && '_seconds' in (paymentDate as object)) {
    const d = new Date((paymentDate as { _seconds: number })._seconds * 1000)
    period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  } else if (paymentDate && typeof (paymentDate as { toDate?: () => Date }).toDate === 'function') {
    const d = (paymentDate as { toDate: () => Date }).toDate()
    period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  } else {
    const now = new Date()
    period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  // Deterministic ID prevents duplicates even under concurrent calls (F-01 fix)
  const commissionId = `comm_${paymentId}`
  const docRef = adminDb.doc(`agents/${agentId}/commissions/${commissionId}`)

  const orderId = typeof paymentData.orderId === 'string' ? paymentData.orderId : ''
  const clientName = typeof paymentData.clientName === 'string' ? paymentData.clientName
    : typeof paymentData.agentName === 'string' ? paymentData.agentName : ''
  const tripName = typeof paymentData.tripName === 'string' ? paymentData.tripName : ''

  // Transaction: check-then-set atomically to prevent overwriting approved/paid commissions
  await adminDb.runTransaction(async (tx) => {
    const existing = await tx.get(docRef)
    if (existing.exists) {
      console.info(`[Commission Hook] Commission already exists for paymentId=${paymentId}, skipping`)
      return
    }

    tx.set(docRef, {
      paymentId,
      orderId,
      agentId,
      clientName,
      tripName,
      paymentAmountCents: amountCents,
      commissionRate,
      commissionAmountCents,
      status: 'pending',
      period,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      approvedBy: null,
      approvedAt: null,
      paidAt: null,
    })
  })
}
