import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const sa = JSON.parse(
  readFileSync('.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json', 'utf8')
)
initializeApp({ credential: cert(sa) })
const db = getFirestore()

const agentId = 'gif7XVStiEfOJFrBMCeECQOgJfZ2'
const now = new Date()
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
const startTimestamp = Timestamp.fromDate(startOfMonth)

async function run(label, fn) {
  try {
    const t = Date.now()
    const snap = await fn()
    console.log(`OK  ${label}: ${snap.size} docs (${Date.now() - t}ms)`)
  } catch (e) {
    console.error(`ERR ${label}:`, e?.code, e?.message)
    if (e?.details) console.error('  details:', e.details)
  }
}

await run('verifiedPayments', () =>
  db.collection('payments')
    .where('agentId', '==', agentId)
    .where('status', '==', 'verified')
    .where('createdAt', '>=', startTimestamp)
    .orderBy('createdAt', 'desc')
    .get()
)

await run('activeOrders', () =>
  db.collection('orders')
    .where('agentId', '==', agentId)
    .where('status', 'in', ['Interesado', 'Confirmado', 'En Progreso'])
    .limit(500)
    .get()
)

await run('pendingCommissions', () =>
  db.collectionGroup('commissions')
    .where('agentId', '==', agentId)
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'desc')
    .get()
)

await run('earnedCommissions', () =>
  db.collectionGroup('commissions')
    .where('agentId', '==', agentId)
    .where('status', 'in', ['approved', 'paid'])
    .orderBy('createdAt', 'desc')
    .get()
)

process.exit(0)
