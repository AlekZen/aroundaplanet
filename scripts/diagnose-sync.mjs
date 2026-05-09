/**
 * Diagnóstico: Compara productos en Odoo vs Firestore
 * Ejecutar: node scripts/diagnose-sync.mjs
 */
import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import xmlrpc from 'xmlrpc'

// --- Firebase Admin ---
const sa = JSON.parse(readFileSync('.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json', 'utf8'))
const app = initializeApp({ credential: cert(sa) })
const db = getFirestore(app)

// --- Odoo XML-RPC ---
const ODOO_URL = 'aroundaplanet.odoo.com'
const ODOO_DB = 'aroundaplanet'
const ODOO_USER = process.env.ODOO_USERNAME
const ODOO_PASS = process.env.ODOO_API_KEY

if (!ODOO_USER || !ODOO_PASS) {
  console.error('Falta ODOO_USERNAME o ODOO_API_KEY en env')
  process.exit(1)
}

const commonClient = xmlrpc.createSecureClient({ host: ODOO_URL, port: 443, path: '/xmlrpc/2/common' })
const objectClient = xmlrpc.createSecureClient({ host: ODOO_URL, port: 443, path: '/xmlrpc/2/object' })

function rpc(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, val) => err ? reject(err) : resolve(val))
  })
}

async function odooAuth() {
  return rpc(commonClient, 'authenticate', [ODOO_DB, ODOO_USER, ODOO_PASS, {}])
}

async function odooSearchRead(uid, model, domain, fields, opts = {}) {
  return rpc(objectClient, 'execute_kw', [
    ODOO_DB, uid, ODOO_PASS, model, 'search_read',
    [domain], { fields, ...opts }
  ])
}

async function main() {
  console.log('=== DIAGNÓSTICO DE SYNC ===\n')

  // 1. Autenticación Odoo
  const uid = await odooAuth()
  console.log(`Odoo UID: ${uid}\n`)

  // 2. Buscar TODOS los productos tipo servicio activos con precio >= 5000
  //    SIN filtro de nombre
  const allProducts = await odooSearchRead(uid, 'product.template',
    [['type', '=', 'service'], ['active', '=', true], ['list_price', '>=', 5000]],
    ['id', 'name', 'list_price', 'write_date', 'active', 'type'],
    { order: 'id asc' }
  )
  console.log(`--- ODOO: Productos servicio activos (precio >= $50) SIN filtro nombre ---`)
  console.log(`Total: ${allProducts.length}\n`)
  for (const p of allProducts) {
    const has2026 = p.name.toLowerCase().includes('2026')
    console.log(`  ID=${p.id} | $${p.list_price.toLocaleString()} | ${has2026 ? '✓2026' : '✗NO-2026'} | "${p.name}"`)
  }

  // 3. Buscar con el filtro actual (nameFilter: '2026')
  const filtered = await odooSearchRead(uid, 'product.template',
    [['type', '=', 'service'], ['active', '=', true], ['list_price', '>=', 5000], ['name', 'ilike', '2026']],
    ['id', 'name', 'list_price'],
    { order: 'id asc' }
  )
  console.log(`\n--- ODOO: Con filtro nameFilter='2026' (lo que sync realmente trae) ---`)
  console.log(`Total: ${filtered.length}\n`)
  for (const p of filtered) {
    console.log(`  ID=${p.id} | $${p.list_price.toLocaleString()} | "${p.name}"`)
  }

  // 4. Productos excluidos por el filtro
  const filteredIds = new Set(filtered.map(p => p.id))
  const excluded = allProducts.filter(p => !filteredIds.has(p.id))
  if (excluded.length > 0) {
    console.log(`\n--- EXCLUIDOS por nameFilter='2026' (NUNCA se sincronizan) ---`)
    console.log(`Total excluidos: ${excluded.length}\n`)
    for (const p of excluded) {
      console.log(`  ID=${p.id} | $${p.list_price.toLocaleString()} | "${p.name}"`)
    }
  } else {
    console.log(`\nNo hay productos excluidos por el filtro de nombre.`)
  }

  // 5. Leer TODOS los trips de Firestore
  const tripsSnap = await db.collection('trips').get()
  console.log(`\n--- FIRESTORE: Colección trips ---`)
  console.log(`Total documentos: ${tripsSnap.size}\n`)
  for (const doc of tripsSnap.docs) {
    const d = doc.data()
    const lastSync = d.lastSyncAt?.toDate?.()?.toISOString?.() ?? d.lastSyncAt ?? 'nunca'
    console.log(`  ${doc.id} | odooId=${d.odooProductId ?? 'N/A'} | active=${d.isActive ?? '?'} | published=${d.isPublished ?? '?'} | "${d.odooName ?? '?'}" | lastSync=${lastSync}`)
  }

  // 6. Comparar
  const firestoreOdooIds = new Set()
  for (const doc of tripsSnap.docs) {
    const d = doc.data()
    if (d.odooProductId) firestoreOdooIds.add(d.odooProductId)
  }

  const inOdooNotFirestore = allProducts.filter(p => !firestoreOdooIds.has(p.id))
  if (inOdooNotFirestore.length > 0) {
    console.log(`\n--- EN ODOO PERO NO EN FIRESTORE (productos faltantes) ---`)
    for (const p of inOdooNotFirestore) {
      console.log(`  ID=${p.id} | "${p.name}" | $${p.list_price.toLocaleString()}`)
    }
  } else {
    console.log(`\nTodos los productos de Odoo están en Firestore.`)
  }

  // 7. Audit log - últimos syncs
  const auditSnap = await db.collection('auditLog')
    .where('action', '==', 'odoo.tripSyncCompleted')
    .orderBy('timestamp', 'desc')
    .limit(5)
    .get()
  console.log(`\n--- ÚLTIMOS 5 SYNCS (auditLog) ---`)
  for (const doc of auditSnap.docs) {
    const d = doc.data()
    const ts = d.timestamp?.toDate?.()?.toISOString?.() ?? '?'
    const det = d.details ?? {}
    console.log(`  ${ts} | total=${det.total} created=${det.created} updated=${det.updated} errors=${det.errors} | filter="${det.nameFilter ?? 'none'}" | by=${d.performedBy}`)
  }

  console.log('\n=== FIN DIAGNÓSTICO ===')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
