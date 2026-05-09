/**
 * Diagnóstico parte 2: Solo Firestore trips + comparación
 */
import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const sa = JSON.parse(readFileSync('.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json', 'utf8'))
const app = initializeApp({ credential: cert(sa) })
const db = getFirestore(app)

async function main() {
  // 1. Todos los trips en Firestore
  const tripsSnap = await db.collection('trips').get()
  console.log(`=== FIRESTORE: ${tripsSnap.size} trips ===\n`)

  const firestoreTrips = []
  for (const doc of tripsSnap.docs) {
    const d = doc.data()
    const lastSync = d.lastSyncAt?.toDate?.()?.toISOString?.()?.slice(0, 19) ?? 'nunca'
    const updatedAt = d.updatedAt?.toDate?.()?.toISOString?.()?.slice(0, 19) ?? '?'
    firestoreTrips.push({
      docId: doc.id,
      odooId: d.odooProductId ?? null,
      name: d.odooName ?? '?',
      active: d.isActive ?? '?',
      published: d.isPublished ?? '?',
      lastSync,
      updatedAt,
    })
    console.log(`  ${doc.id} | odoo=${d.odooProductId} | active=${d.isActive} | published=${d.isPublished} | sync=${lastSync} | "${d.odooName}"`)
  }

  // 2. Resumen
  const published = firestoreTrips.filter(t => t.published === true)
  const unpublished = firestoreTrips.filter(t => t.published === false)
  const inactive = firestoreTrips.filter(t => t.active === false)

  console.log(`\n=== RESUMEN ===`)
  console.log(`Total en Firestore: ${firestoreTrips.length}`)
  console.log(`Publicados (visibles en catálogo): ${published.length}`)
  console.log(`No publicados (draft): ${unpublished.length}`)
  console.log(`Inactivos (soft-deleted): ${inactive.length}`)

  if (unpublished.length > 0) {
    console.log(`\n--- NO PUBLICADOS (Paloma no los ve en catálogo) ---`)
    for (const t of unpublished) {
      console.log(`  odoo=${t.odooId} | "${t.name}" | lastSync=${t.lastSync}`)
    }
  }

  // 3. Últimos audit logs (sin composite index, buscar todos ordenados por nombre)
  try {
    const auditSnap = await db.collection('auditLog')
      .where('action', '==', 'odoo.tripSyncCompleted')
      .limit(10)
      .get()
    console.log(`\n=== ÚLTIMOS SYNCS ===`)
    for (const doc of auditSnap.docs) {
      const d = doc.data()
      const ts = d.timestamp?.toDate?.()?.toISOString?.()?.slice(0, 19) ?? '?'
      const det = d.details ?? {}
      console.log(`  ${ts} | total=${det.total} created=${det.created} updated=${det.updated} errors=${det.errors} | filter="${det.nameFilter}"`)
    }
  } catch {
    console.log('\n(Audit log query requiere índice compuesto, omitido)')
  }

  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
