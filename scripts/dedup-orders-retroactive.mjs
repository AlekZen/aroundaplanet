/**
 * Dedup retroactivo de orders/ — agrupa por (tripId|phoneNormalizado|YYYY-MM-DD createdAt).
 * Mantiene el más antiguo como canónico; marca los demás como status='Duplicado'.
 * NUNCA borra. Read-only por default. Usa --apply para escribir.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const keyPath = '.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json'
const sa = JSON.parse(readFileSync(keyPath, 'utf-8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const TARGET_STATUSES = ['Interesado', 'Cotizado']
const SCRIPT_TAG = 'scripts/dedup-orders-retroactive.mjs'

function normalizePhone(p) {
  return (p ?? '').toString().replace(/\D/g, '')
}

function toDate(ts) {
  if (!ts) return null
  if (typeof ts.toDate === 'function') return ts.toDate()
  if (ts._seconds) return new Date(ts._seconds * 1000)
  return new Date(ts)
}

function ymd(d) {
  if (!d) return 'no-date'
  return d.toISOString().slice(0, 10)
}

// Pre-cargar nombres de viajes para reporte legible
const tripsSnap = await db.collection('trips').get()
const tripNames = {}
for (const t of tripsSnap.docs) {
  tripNames[t.id] = (t.data().odooName ?? '').toString()
}

const ordersSnap = await db
  .collection('orders')
  .where('status', 'in', TARGET_STATUSES)
  .get()

console.log(`Orders en estados ${TARGET_STATUSES.join('/')}: ${ordersSnap.size}`)

const groups = new Map()
for (const doc of ordersSnap.docs) {
  const d = doc.data()
  if (d.dedupedInto) continue // ya marcado previamente
  const phone = normalizePhone(d.contactPhone)
  const created = toDate(d.createdAt)
  const key = `${d.tripId ?? 'no-trip'}|${phone || 'no-phone'}|${ymd(created)}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push({ id: doc.id, data: d, created })
}

const dupGroups = [...groups.entries()].filter(([, arr]) => arr.length > 1)
console.log(`\nGrupos con duplicados encontrados: ${dupGroups.length}`)

let toWrite = 0
let wrote = 0
const PALOMA_HITS = []

for (const [key, arr] of dupGroups) {
  arr.sort((a, b) => (a.created?.getTime() ?? 0) - (b.created?.getTime() ?? 0))
  const canonical = arr[0]
  const dups = arr.slice(1)
  const [tripId, phone, day] = key.split('|')
  const tripName = tripNames[tripId] ?? '(sin nombre)'
  const name = canonical.data.contactName ?? '(sin nombre)'

  const isPaloma = /paloma/i.test(name) && /chiapas/i.test(tripName)
  if (isPaloma) PALOMA_HITS.push({ key, tripName, name, canonicalId: canonical.id, dupIds: dups.map((x) => x.id) })

  console.log(
    `\n[GRUPO] ${tripName} | ${name} | phone=${phone} | ${day}` +
      `\n   canonical: ${canonical.id} (createdAt=${canonical.created?.toISOString() ?? '?'})` +
      `\n   duplicados (${dups.length}): ${dups.map((x) => `${x.id}@${x.created?.toISOString() ?? '?'}`).join(', ')}`
  )

  for (const dup of dups) {
    toWrite++
    console.log(`   ${APPLY ? 'WROTE' : 'WOULD'}: ${dup.id} → status=Duplicado dedupedInto=${canonical.id}`)
    if (APPLY) {
      await db.collection('orders').doc(dup.id).set(
        {
          status: 'Duplicado',
          dedupedInto: canonical.id,
          dedupedAt: FieldValue.serverTimestamp(),
          dedupedBy: SCRIPT_TAG,
          previousStatus: dup.data.status,
        },
        { merge: true }
      )
      wrote++
    }
  }
}

console.log(`\n========== RESUMEN ==========`)
console.log(`Grupos con duplicados: ${dupGroups.length}`)
console.log(`Documentos a marcar Duplicado: ${toWrite}`)
console.log(`Documentos escritos: ${APPLY ? wrote : 0} (${APPLY ? 'APPLY' : 'DRY-RUN'})`)
if (PALOMA_HITS.length) {
  console.log(`\nPALOMA (CHIAPAS) matches: ${PALOMA_HITS.length}`)
  console.log(JSON.stringify(PALOMA_HITS, null, 2))
} else {
  console.log(`\nPALOMA (CHIAPAS): sin matches en este corte.`)
}
