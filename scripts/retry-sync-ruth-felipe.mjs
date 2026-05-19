import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const keyPath = '.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json'
const sa = JSON.parse(readFileSync(keyPath, 'utf-8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const ids = ['ZsAt3YJlfBpxQUSIxxCW', 'Qzi8E4XIlC4fNoET3tjJ']

for (const id of ids) {
  const ref = db.collection('payments').doc(id)
  const snap = await ref.get()
  if (!snap.exists) { console.log(`[${id}] NOT FOUND`); continue }
  const d = snap.data()
  console.log(`[${id}] BEFORE: status=${d.status} odooSyncStatus=${d.odooSyncStatus} odooPaymentId=${d.odooPaymentId ?? 'null'} odooLastError="${(d.odooLastError ?? '').slice(0,100)}"`)
}
