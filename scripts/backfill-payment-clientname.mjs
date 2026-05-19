/**
 * BUG-F backfill — Denormaliza orders.contactName → payments.clientName
 * para pagos legacy (POST /api/payments empezó a denormalizar después).
 *
 * Read-only por default. Usa --apply para escribir.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const keyPath = '.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json'
const sa = JSON.parse(readFileSync(keyPath, 'utf-8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const paymentsSnap = await db.collection('payments').get()
const candidates = []
for (const doc of paymentsSnap.docs) {
  const d = doc.data()
  const cn = (d.clientName ?? '').toString().trim()
  if (!cn && d.orderId) candidates.push({ id: doc.id, orderId: d.orderId, status: d.status, amountCents: d.amountCents })
}
console.log(`Pagos sin clientName: ${candidates.length}/${paymentsSnap.size}`)

let updated = 0
let skipped = 0
for (const c of candidates) {
  const orderSnap = await db.collection('orders').doc(c.orderId).get()
  if (!orderSnap.exists) { console.log(`[${c.id}] order ${c.orderId} NOT FOUND — skip`); skipped++; continue }
  const order = orderSnap.data()
  const contactName = (order.contactName ?? '').toString().trim()
  const contactPhone = (order.contactPhone ?? '').toString().trim() || null
  const userId = order.userId ?? null
  if (!contactName) { console.log(`[${c.id}] order.contactName empty — skip`); skipped++; continue }
  console.log(`[${c.id}] ${APPLY ? 'WRITE' : 'WOULD'}: clientName="${contactName}" clientPhone=${contactPhone ?? 'null'} clientId=${userId ?? 'null'} status=${c.status} amount=${(c.amountCents ?? 0) / 100}`)
  if (APPLY) {
    await db.collection('payments').doc(c.id).set(
      {
        clientName: contactName,
        clientPhone: contactPhone,
        clientId: userId,
        backfilledAt: FieldValue.serverTimestamp(),
        backfilledBy: 'scripts/backfill-payment-clientname.mjs',
      },
      { merge: true },
    )
    updated++
  }
}
console.log(`DONE — ${APPLY ? `wrote ${updated}` : `would write ${candidates.length - skipped}`} · skipped ${skipped}`)
