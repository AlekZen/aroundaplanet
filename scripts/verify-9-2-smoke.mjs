/**
 * Story 9.2 smoke — inspecciona estado sync de un pago Firestore.
 * Uso: node scripts/verify-9-2-smoke.mjs <firestorePaymentId>
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import admin from 'firebase-admin'

const paymentId = process.argv[2]
if (!paymentId) {
  console.error('Uso: node scripts/verify-9-2-smoke.mjs <firestorePaymentId>')
  process.exit(1)
}

if (!admin.apps.length) {
  const keyPath = resolve(process.cwd(), '.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json')
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'))
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

const db = admin.firestore()
const snap = await db.collection('payments').doc(paymentId).get()
if (!snap.exists) {
  console.error(`[fail] payment ${paymentId} no existe`)
  process.exit(1)
}
const d = snap.data()
const summary = {
  id: paymentId,
  status: d.status,
  amountCents: d.amountCents,
  clientName: d.clientName,
  verifiedAt: d.verifiedAt?.toDate?.()?.toISOString() ?? null,
  odooPaymentId: d.odooPaymentId ?? null,
  odooSyncStatus: d.odooSyncStatus ?? null,
  odooState: d.odooState ?? null,
  odooJournalId: d.odooJournalId ?? null,
  odooJournalName: d.odooJournalName ?? null,
  odooSyncedAt: d.odooSyncedAt?.toDate?.()?.toISOString() ?? null,
  odooLastError: d.odooLastError ?? null,
  syncRetryCount: d.syncRetryCount ?? 0,
}
console.log(JSON.stringify(summary, null, 2))

const synced = summary.odooSyncStatus === 'synced' && typeof summary.odooPaymentId === 'number'
console.log(synced ? '\n[OK] payment sincronizado' : '\n[CHECK] revisa odooSyncStatus + odooLastError')
process.exit(0)
