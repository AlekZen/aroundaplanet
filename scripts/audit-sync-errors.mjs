/**
 * Audit sync errors - 2 pagos verificados con badge "Sync con error"
 * Read-only. NO modifica data.
 * Ejecutar: node scripts/audit-sync-errors.mjs
 */
import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const sa = JSON.parse(readFileSync('.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json', 'utf8'))
const app = initializeApp({ credential: cert(sa) })
const db = getFirestore(app)

const TARGETS = [
  { label: 'RUTH CERDA GONZALEZ', nameTokens: ['ruth', 'cerda'], amount: 20000 },
  { label: 'FELIPE DE JESUS RUBIO RUIZ', nameTokens: ['felipe', 'rubio'], amount: 5650 },
]

function fmtTs(v) {
  if (!v) return 'null'
  if (v.toDate) return v.toDate().toISOString()
  if (v._seconds) return new Date(v._seconds * 1000).toISOString()
  return String(v)
}

async function findPayment(target) {
  // Pull all payments and filter client-side (collection should be manageable)
  const snap = await db.collection('payments').get()
  const matches = []
  for (const doc of snap.docs) {
    const d = doc.data()
    const name = String(d.clientName ?? '').toLowerCase()
    const hits = target.nameTokens.every((t) => name.includes(t))
    if (!hits) continue
    const amt = Number(d.amount ?? 0)
    // amount in centavos vs pesos — try both
    matches.push({ id: doc.id, data: d, amt })
  }
  return matches
}

async function findAlerts(paymentId) {
  const snap = await db.collection('paymentAlerts').where('paymentId', '==', paymentId).get()
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }))
}

async function main() {
  console.log('=== AUDIT SYNC ERRORS ===\n')
  for (const t of TARGETS) {
    console.log(`\n--- TARGET: ${t.label} ($${t.amount.toLocaleString()}) ---`)
    const matches = await findPayment(t)
    console.log(`Matches encontrados: ${matches.length}`)
    for (const m of matches) {
      const d = m.data
      console.log(`\n  Payment id: ${m.id}`)
      console.log(`    clientName:         ${d.clientName}`)
      console.log(`    amount:             ${d.amount}  (centavos? ${d.amount > 100000 ? 'sí' : 'no'})`)
      console.log(`    status:             ${d.status}`)
      console.log(`    tripName:           ${d.tripName ?? d.tripId}`)
      console.log(`    agentName:          ${d.agentName ?? d.agentId}`)
      console.log(`    paymentDate:        ${fmtTs(d.paymentDate)}`)
      console.log(`    createdAt:          ${fmtTs(d.createdAt)}`)
      console.log(`    verifiedAt:         ${fmtTs(d.verifiedAt)}`)
      console.log(`    verifiedBy:         ${d.verifiedBy ?? 'null'}`)
      console.log(`    odooPaymentId:      ${d.odooPaymentId ?? 'NULL'}`)
      console.log(`    odooSyncStatus:     ${d.odooSyncStatus ?? 'null'}`)
      console.log(`    odooSyncError:      ${d.odooSyncError ?? 'null'}`)
      console.log(`    odooSyncErrorCode:  ${d.odooSyncErrorCode ?? 'null'}`)
      console.log(`    syncRetries:        ${d.syncRetries ?? 0}`)
      console.log(`    lastSyncAttemptAt:  ${fmtTs(d.lastSyncAttemptAt)}`)
      console.log(`    odooState:          ${d.odooState ?? 'null'}`)
      console.log(`    odooJournalName:    ${d.odooJournalName ?? 'null'}`)
      console.log(`    odooSyncedAt:       ${fmtTs(d.odooSyncedAt)}`)
      console.log(`    referenceNumber:    ${d.referenceNumber ?? 'null'}`)
      // Dump full keys for visibility
      const otherKeys = Object.keys(d).filter((k) => !['clientName','amount','status','tripName','tripId','agentName','agentId','paymentDate','createdAt','verifiedAt','verifiedBy','odooPaymentId','odooSyncStatus','odooSyncError','odooSyncErrorCode','syncRetries','lastSyncAttemptAt','odooState','odooJournalName','odooSyncedAt','referenceNumber','clientId','clientPhone','receiptUrl'].includes(k))
      if (otherKeys.length) console.log(`    [otras keys]: ${otherKeys.join(', ')}`)

      const alerts = await findAlerts(m.id)
      console.log(`    paymentAlerts: ${alerts.length}`)
      for (const a of alerts) {
        console.log(`      - alertId=${a.id}`)
        console.log(`        severity:  ${a.data.severity}`)
        console.log(`        type:      ${a.data.type ?? a.data.kind ?? 'n/a'}`)
        console.log(`        message:   ${a.data.message}`)
        console.log(`        createdAt: ${fmtTs(a.data.createdAt)}`)
        console.log(`        resolved:  ${a.data.resolved ?? a.data.isResolved ?? 'n/a'}`)
      }
    }
  }
  console.log('\n=== FIN ===')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
