/* eslint-disable @typescript-eslint/no-explicit-any */
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'

const KEY_PATH = '.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json'

if (!getApps().length) {
  const serviceAccount = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'))
  initializeApp({ credential: cert(serviceAccount) })
}
const db = getFirestore()

function tsToIso(v: any): string | null {
  if (!v) return null
  if (v instanceof Timestamp) return v.toDate().toISOString()
  if (typeof v?.toDate === 'function') return v.toDate().toISOString()
  if (typeof v === 'string') return v
  return null
}

function inc(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1
}

async function main() {
  console.log('Leyendo coleccion payments...')

  const totalSnap = await db.collection('payments').count().get()
  const totalPayments = totalSnap.data().count

  const snap = await db
    .collection('payments')
    .orderBy('createdAt', 'desc')
    .limit(300)
    .get()

  const payments = snap.docs.map((d) => {
    const x = d.data()
    return {
      paymentId: d.id,
      orderId: x.orderId ?? null,
      amountCents: x.amountCents ?? null,
      paymentMethod: x.paymentMethod ?? null,
      date: x.date ?? null,
      status: x.status ?? null,
      agentId: x.agentId ?? null,
      agentName: x.agentName ?? null,
      clientId: x.clientId ?? null,
      clientName: x.clientName ?? null,
      clientPhone: x.clientPhone ?? null,
      tripName: x.tripName ?? null,
      bankName: x.bankName ?? null,
      bankReference: x.bankReference ?? null,
      beneficiaryName: x.beneficiaryName ?? null,
      concept: x.concept ?? null,
      sourceAccount: x.sourceAccount ?? null,
      destinationAccount: x.destinationAccount ?? null,
      notes: x.notes ?? null,
      receiptUrl: x.receiptUrl ?? null,
      odooPaymentId: x.odooPaymentId ?? null,
      syncedToOdoo: x.syncedToOdoo ?? null,
      registeredBy: x.registeredBy ?? null,
      rejectionNote: x.rejectionNote ?? null,
      createdAt: tsToIso(x.createdAt),
      verifiedAt: tsToIso(x.verifiedAt),
      updatedAt: tsToIso(x.updatedAt),
    }
  })

  // Aggregates
  const byStatus: Record<string, number> = {}
  const byMethod: Record<string, number> = {}
  const byAgent: Record<string, { name: string; count: number; amountCents: number }> = {}
  const fieldEmpty: Record<string, number> = {}
  const fields = [
    'orderId', 'agentId', 'agentName', 'clientId', 'clientName', 'clientPhone',
    'tripName', 'bankReference', 'bankName', 'beneficiaryName', 'concept',
    'sourceAccount', 'destinationAccount', 'notes', 'receiptUrl',
  ]
  for (const f of fields) fieldEmpty[f] = 0

  let withOdooId = 0
  let syncedTrue = 0
  let noBankRef = 0
  let noAgentId = 0
  let noClientId = 0
  let noTripName = 0

  const bankRefMap: Record<string, string[]> = {}
  const dedupKeyMap: Record<string, string[]> = {}

  const dates: string[] = []

  for (const p of payments) {
    inc(byStatus, p.status ?? 'null')
    inc(byMethod, p.paymentMethod ?? 'null')

    if (p.agentId) {
      const k = p.agentId
      if (!byAgent[k]) byAgent[k] = { name: p.agentName ?? '(sin nombre)', count: 0, amountCents: 0 }
      byAgent[k].count += 1
      byAgent[k].amountCents += Number(p.amountCents ?? 0)
    } else {
      noAgentId += 1
    }
    if (!p.clientId) noClientId += 1
    if (!p.tripName) noTripName += 1

    if (p.odooPaymentId) withOdooId += 1
    if (p.syncedToOdoo === true) syncedTrue += 1
    if (!p.bankReference) noBankRef += 1

    for (const f of fields) {
      const v = (p as any)[f]
      if (v == null || v === '') fieldEmpty[f] += 1
    }

    if (p.bankReference) {
      const ref = String(p.bankReference).trim()
      if (ref) {
        if (!bankRefMap[ref]) bankRefMap[ref] = []
        bankRefMap[ref].push(p.paymentId)
      }
    }

    const dk = `${p.orderId}|${p.amountCents}|${p.date}`
    if (!dedupKeyMap[dk]) dedupKeyMap[dk] = []
    dedupKeyMap[dk].push(p.paymentId)

    if (p.createdAt) dates.push(p.createdAt)
  }

  const duplicateBankRefs = Object.entries(bankRefMap)
    .filter(([, ids]) => ids.length > 1)
    .map(([ref, ids]) => ({ ref, ids }))

  const duplicateInternal = Object.entries(dedupKeyMap)
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }))

  const topAgents = Object.entries(byAgent)
    .map(([id, v]) => ({ agentId: id, agentName: v.name, count: v.count, amountCents: v.amountCents }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  dates.sort()
  const dateRange = {
    first: dates[0] ?? null,
    last: dates[dates.length - 1] ?? null,
    sampleSize: dates.length,
  }

  // Orders for last-60d verified payments
  console.log('Leyendo orders de pagos verified ultimos 60 dias...')
  const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000
  const recentVerifiedOrderIds = new Set<string>()
  for (const p of payments) {
    if (p.status !== 'verified') continue
    if (!p.orderId) continue
    const ts = p.createdAt ? Date.parse(p.createdAt) : 0
    if (ts >= sixtyDaysAgo) recentVerifiedOrderIds.add(String(p.orderId))
  }

  const orders: any[] = []
  for (const oid of recentVerifiedOrderIds) {
    try {
      const oSnap = await db.collection('orders').doc(oid).get()
      if (oSnap.exists) {
        const o = oSnap.data() as any
        orders.push({
          orderId: oSnap.id,
          contactName: o?.contactName ?? null,
          agentId: o?.agentId ?? null,
          tripId: o?.tripId ?? null,
          tripName: o?.tripName ?? null,
          amountTotalCents: o?.amountTotalCents ?? null,
          status: o?.status ?? null,
          createdAt: tsToIso(o?.createdAt),
        })
      } else {
        orders.push({ orderId: oid, missing: true })
      }
    } catch (e: any) {
      orders.push({ orderId: oid, error: e?.message ?? String(e) })
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      totalPaymentsCollection: totalPayments,
      sampleSize: payments.length,
    },
    byStatus,
    byMethod,
    topAgents,
    flags: {
      withOdooPaymentId: withOdooId,
      syncedToOdooTrue: syncedTrue,
      noBankReference: noBankRef,
      noAgentId,
      noClientId,
      noTripName,
    },
    fieldEmptyCounts: fieldEmpty,
    duplicateBankRefs,
    duplicateInternalKeys: duplicateInternal,
    dateRange,
    payments,
    relatedOrders: orders,
  }

  const outDir = path.join('scripts', 'audit-output')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'firestore-real-data.json')
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')

  console.log('Listo:', outPath)
  console.log('Total pagos coleccion:', totalPayments)
  console.log('Muestra analizada:', payments.length)
  console.log('byStatus:', byStatus)
  console.log('byMethod:', byMethod)
  console.log('Flags:', report.flags)
  console.log('Top agentes (5):', topAgents.slice(0, 5))
  console.log('Duplicados bankRef:', duplicateBankRefs.length)
  console.log('Duplicados internos (orderId+amount+date):', duplicateInternal.length)
  console.log('Rango fechas:', dateRange)
  console.log('Orders verified 60d enriquecidas:', orders.length)
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
