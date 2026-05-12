/**
 * Batch enrichment de OdooPaymentRow con viaje + agente + sale.order + payment method.
 *
 * Resolución (todos batched en 4 Odoo searchRead + 1 Firestore parallel):
 *
 *   payment.memo → account.move.name → invoice_origin
 *                → sale.order.name → team_id, lines.product_template_id
 *                                  → crm.team / odooAgents
 *                                  → trips/odoo-{productId}.odooName
 *
 * Si cualquier eslabón falla, el campo enriquecido queda null (no crash).
 *
 * IMPORTANTE: Esta función NO escribe nada. Solo lecturas Odoo + Firestore.
 */

import type { OdooClient } from '@/lib/odoo/client'
import { adminDb } from '@/lib/firebase/admin'
import type { OdooPaymentRow } from './duplicateClustering'

interface EnrichmentResult {
  byPaymentId: Map<number, {
    tripName: string | null
    agentName: string | null
    saleOrderName: string | null
    paymentMethodLine: string | null
    communication: string | null
    reconcileDate: string | null
  }>
}

interface AccountMoveRaw {
  id: number
  name?: string | false
  invoice_origin?: string | false
}

interface SaleOrderRaw {
  id: number
  name?: string | false
  team_id?: [number, string] | false
}

interface SaleOrderLineRaw {
  order_id?: [number, string] | false
  product_template_id?: [number, string] | false
}

interface PaymentExtraRaw {
  id: number
  payment_method_line_id?: [number, string] | false
  communication?: string | false
  write_date?: string | false
  date?: string | false
}

function tupleId(t: [number, string] | false | undefined): number | null {
  if (!t || !Array.isArray(t)) return null
  return t[0] ?? null
}
function tupleName(t: [number, string] | false | undefined): string | null {
  if (!t || !Array.isArray(t)) return null
  return t[1] ?? null
}

/**
 * Enriquece pagos de duplicate clusters con datos de viaje/agente/orden.
 * Ejecuta 4 queries Odoo + 1 Firestore en paralelo. Tolera fallos parciales.
 */
export async function enrichDuplicatePayments(
  client: OdooClient,
  payments: OdooPaymentRow[],
): Promise<EnrichmentResult> {
  const byPaymentId = new Map<number, {
    tripName: string | null
    agentName: string | null
    saleOrderName: string | null
    paymentMethodLine: string | null
    communication: string | null
    reconcileDate: string | null
  }>()
  for (const p of payments) {
    byPaymentId.set(p.id, {
      tripName: null,
      agentName: null,
      saleOrderName: null,
      paymentMethodLine: null,
      communication: null,
      reconcileDate: null,
    })
  }

  if (payments.length === 0) return { byPaymentId }

  const ids = payments.map((p) => p.id)
  const memos = Array.from(
    new Set(payments.map((p) => p.memo).filter((m): m is string => !!m)),
  )

  // === 1. Extra fields del propio payment (method_line, communication, write_date) ===
  const extraPaymentsPromise = client
    .read('account.payment', ids, [
      'id',
      'payment_method_line_id',
      'communication',
      'write_date',
      'date',
    ])
    .catch(() => [] as unknown[]) as Promise<PaymentExtraRaw[]>

  // === 2. account.move por memo → invoice_origin ===
  // Buscamos por name o ref que coincida con memo. Si memo está vacío, skip.
  const movesPromise = memos.length > 0
    ? (client
        .searchRead(
          'account.move',
          [['name', 'in', memos]],
          ['id', 'name', 'invoice_origin'],
          { limit: 500 },
        )
        .catch(() => [] as unknown[]) as Promise<AccountMoveRaw[]>)
    : Promise.resolve([] as AccountMoveRaw[])

  const [extraPayments, moves] = await Promise.all([extraPaymentsPromise, movesPromise])

  // Aplicar extras del payment
  for (const ep of extraPayments) {
    const entry = byPaymentId.get(ep.id)
    if (!entry) continue
    entry.paymentMethodLine = tupleName(ep.payment_method_line_id)
    entry.communication = typeof ep.communication === 'string' ? ep.communication : null
    const wd = typeof ep.write_date === 'string' ? ep.write_date.slice(0, 10) : null
    const d = typeof ep.date === 'string' ? ep.date : null
    // reconcileDate solo si difiere del date original (captura tardía)
    entry.reconcileDate = wd && d && wd !== d ? wd : null
  }

  // memo → invoice_origin
  const memoToOrigin = new Map<string, string>()
  for (const m of moves) {
    const name = typeof m.name === 'string' ? m.name : null
    const origin = typeof m.invoice_origin === 'string' ? m.invoice_origin : null
    if (name && origin) memoToOrigin.set(name, origin)
  }
  const origins = Array.from(new Set(memoToOrigin.values()))

  if (origins.length === 0) {
    return { byPaymentId }
  }

  // === 3. sale.order por origin (name) → team_id ===
  const orders = (await client
    .searchRead(
      'sale.order',
      [['name', 'in', origins]],
      ['id', 'name', 'team_id'],
      { limit: 500 },
    )
    .catch(() => [] as unknown[])) as SaleOrderRaw[]

  const orderNameToData = new Map<string, { id: number; teamId: number | null }>()
  for (const o of orders) {
    const name = typeof o.name === 'string' ? o.name : null
    if (!name) continue
    orderNameToData.set(name, { id: o.id, teamId: tupleId(o.team_id) })
  }
  const orderIds = Array.from(orderNameToData.values()).map((v) => v.id)
  const teamIds = Array.from(
    new Set(
      Array.from(orderNameToData.values())
        .map((v) => v.teamId)
        .filter((t): t is number => t !== null),
    ),
  )

  // === 4. sale.order.line → product_template_id ===
  const linesPromise = orderIds.length > 0
    ? (client
        .searchRead(
          'sale.order.line',
          [['order_id', 'in', orderIds]],
          ['order_id', 'product_template_id'],
          { limit: 1000 },
        )
        .catch(() => [] as unknown[]) as Promise<SaleOrderLineRaw[]>)
    : Promise.resolve([] as SaleOrderLineRaw[])

  // === 5. odooAgents Firestore por teamId (fallback crm.team Odoo si no existe) ===
  const agentDocsPromise = teamIds.length > 0
    ? Promise.all(
        teamIds.map((tid) =>
          adminDb.collection('odooAgents').doc(String(tid)).get().catch(() => null),
        ),
      )
    : Promise.resolve([])

  // === 6. trips/odoo-{productId} Firestore (depende de lines, así que se hace después) ===
  const [lines, agentDocs] = await Promise.all([linesPromise, agentDocsPromise])

  const teamIdToAgentName = new Map<number, string>()
  for (let i = 0; i < teamIds.length; i++) {
    const tid = teamIds[i]
    const doc = agentDocs[i]
    if (doc && doc.exists) {
      const name = doc.data()?.name
      if (typeof name === 'string') teamIdToAgentName.set(tid, name)
    }
  }
  // Fallback: cualquier teamId sin nombre Firestore → resolver via crm.team
  const missingTeamIds = teamIds.filter((t) => !teamIdToAgentName.has(t))
  if (missingTeamIds.length > 0) {
    const teams = (await client
      .searchRead('crm.team', [['id', 'in', missingTeamIds]], ['id', 'name'], { limit: 200 })
      .catch(() => [] as unknown[])) as Array<{ id: number; name?: string | false }>
    for (const t of teams) {
      if (typeof t.name === 'string') teamIdToAgentName.set(t.id, t.name)
    }
  }

  // order_id → product_template_id (tomamos el primero por order)
  const orderIdToProductId = new Map<number, number>()
  for (const line of lines) {
    const orderId = tupleId(line.order_id)
    const productId = tupleId(line.product_template_id)
    if (orderId && productId && !orderIdToProductId.has(orderId)) {
      orderIdToProductId.set(orderId, productId)
    }
  }

  // trips/odoo-{productId} Firestore
  const productIds = Array.from(new Set(orderIdToProductId.values()))
  const productToTripName = new Map<number, string>()
  if (productIds.length > 0) {
    const tripSnaps = await Promise.all(
      productIds.map((pid) =>
        adminDb.collection('trips').doc(`odoo-${pid}`).get().catch(() => null),
      ),
    )
    for (let i = 0; i < productIds.length; i++) {
      const pid = productIds[i]
      const snap = tripSnaps[i]
      if (snap && snap.exists) {
        const name = snap.data()?.odooName ?? snap.data()?.name
        if (typeof name === 'string') productToTripName.set(pid, name)
      }
    }
  }

  // === Componer resultado por payment ===
  for (const p of payments) {
    const entry = byPaymentId.get(p.id)!
    if (!p.memo) continue
    const origin = memoToOrigin.get(p.memo)
    if (!origin) continue
    entry.saleOrderName = origin
    const orderData = orderNameToData.get(origin)
    if (!orderData) continue
    if (orderData.teamId !== null) {
      entry.agentName = teamIdToAgentName.get(orderData.teamId) ?? null
    }
    const productId = orderIdToProductId.get(orderData.id)
    if (productId) {
      entry.tripName = productToTripName.get(productId) ?? null
    }
  }

  return { byPaymentId }
}

/** Aplica el enrichment a las filas (mutación in-place de propiedades opcionales). */
export function applyEnrichment(rows: OdooPaymentRow[], result: EnrichmentResult): OdooPaymentRow[] {
  return rows.map((r) => {
    const enriched = result.byPaymentId.get(r.id)
    if (!enriched) return r
    return { ...r, ...enriched }
  })
}

/** Calcula flags cluster-level (sameTrip, sameAgent, maxDateDiffDays). */
export function computeClusterFlags(members: OdooPaymentRow[]): {
  sameTrip: boolean | null
  sameAgent: boolean | null
  maxDateDiffDays: number
} {
  const trips = new Set<string | null>(members.map((m) => m.tripName ?? null))
  const agents = new Set<string | null>(members.map((m) => m.agentName ?? null))

  const sameTrip = trips.has(null)
    ? null
    : trips.size === 1
  const sameAgent = agents.has(null)
    ? null
    : agents.size === 1

  const dates = members
    .map((m) => (m.date ? new Date(m.date + 'T00:00:00Z').getTime() : null))
    .filter((t): t is number => t !== null)
  let maxDateDiffDays = 0
  if (dates.length >= 2) {
    maxDateDiffDays = Math.round((Math.max(...dates) - Math.min(...dates)) / 86_400_000)
  }

  return { sameTrip, sameAgent, maxDateDiffDays }
}
