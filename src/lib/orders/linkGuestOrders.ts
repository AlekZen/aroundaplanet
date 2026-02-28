import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'

const ORDERS_COLLECTION = 'orders'

/** Link orphaned guest orders to a newly authenticated user. Returns count of linked orders. */
export async function linkGuestOrders(userId: string, guestToken: string | null): Promise<number> {
  if (!guestToken) return 0

  const snapshot = await adminDb
    .collection(ORDERS_COLLECTION)
    .where('guestToken', '==', guestToken)
    .where('userId', '==', null)
    .limit(10)
    .get()

  if (snapshot.empty) return 0

  const batch = adminDb.batch()
  for (const doc of snapshot.docs) {
    batch.update(doc.ref, {
      userId,
      guestToken: null,
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()

  return snapshot.size
}
