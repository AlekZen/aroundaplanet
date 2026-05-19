/**
 * Audit YAZIL RAMIREZ payments that fail sync with partner_not_found: <empty>
 * Read-only. NO modifica data.
 * Ejecutar: node scripts/audit-yazil-payments.mjs
 */
import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const sa = JSON.parse(readFileSync('.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json', 'utf8'))
const app = initializeApp({ credential: cert(sa) })
const db = getFirestore(app)

const TARGET_IDS = ['AHpn0QkQGNbzg1Gjxptr', 'TYjYEmlaeOyY5GylmYna']

function fmtTs(v) {
  if (!v) return 'null'
  if (v.toDate) return v.toDate().toISOString()
  if (v._seconds) return new Date(v._seconds * 1000).toISOString()
  return String(v)
}

function dumpVal(v) {
  if (v === undefined) return '<undefined>'
  if (v === null) return '<null>'
  if (v === '') return '<empty-string>'
  if (typeof v === 'object' && v.toDate) return fmtTs(v)
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 200)
  return String(v)
}

async function main() {
  console.log('=== AUDIT YAZIL RAMIREZ PAYMENTS ===\n')

  for (const pid of TARGET_IDS) {
    console.log(`\n========== Payment ${pid} ==========`)
    const snap = await db.collection('payments').doc(pid).get()
    if (!snap.exists) {
      console.log('  NO EXISTE')
      continue
    }
    const d = snap.data()
    const allKeys = Object.keys(d).sort()
    console.log(`  Total fields: ${allKeys.length}`)
    console.log(`  Keys: ${allKeys.join(', ')}`)
    console.log('')
    // Campos cliente
    const clientKeys = ['clientName','clientId','clientPhone','customerName','partnerName','contactName','contactId','contactPhone','beneficiaryName']
    console.log('  --- Campos cliente/contact ---')
    for (const k of clientKeys) {
      console.log(`    ${k.padEnd(20)}: ${dumpVal(d[k])}`)
    }
    console.log('  --- Campos sync ---')
    for (const k of ['status','orderId','agentId','agentName','tripName','tripId','odooSyncStatus','odooLastError','odooLastErrorCode','syncRetryCount','odooPaymentId','verifiedAt','verifiedBy','amountCents','amount']) {
      console.log(`    ${k.padEnd(20)}: ${dumpVal(d[k])}`)
    }

    // Buscar order asociada
    if (d.orderId) {
      console.log(`\n  --- Order ${d.orderId} ---`)
      const oSnap = await db.collection('orders').doc(d.orderId).get()
      if (!oSnap.exists) {
        console.log('    Order NO EXISTE')
      } else {
        const o = oSnap.data()
        for (const k of ['contactName','contactPhone','userId','agentId','tripId','tripName','status']) {
          console.log(`    ${k.padEnd(20)}: ${dumpVal(o[k])}`)
        }
      }
    }
  }

  // Comparar con un pago Yazil que sí muestra "Sync demorado" — buscar por nombre
  console.log('\n\n=== Otros pagos YAZIL (cualquier estado) ===')
  const all = await db.collection('payments').get()
  for (const doc of all.docs) {
    const d = doc.data()
    const nm = String(d.clientName ?? '').toLowerCase()
    if (!nm.includes('yazil')) continue
    console.log(`  ${doc.id} | clientName=${dumpVal(d.clientName)} | amountCents=${d.amountCents} | status=${d.status} | odooSyncStatus=${d.odooSyncStatus} | odooLastError=${dumpVal(d.odooLastError)?.slice?.(0,80)}`)
  }
  // Pagos sin clientName
  console.log('\n=== Pagos SIN clientName (cualquier estado) ===')
  let missing = 0
  for (const doc of all.docs) {
    const d = doc.data()
    if (d.clientName) continue
    missing++
    console.log(`  ${doc.id} | orderId=${d.orderId} | status=${d.status} | odooSyncStatus=${d.odooSyncStatus} | createdAt=${fmtTs(d.createdAt)}`)
  }
  console.log(`  Total sin clientName: ${missing} de ${all.size}`)

  console.log('\n=== FIN ===')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
