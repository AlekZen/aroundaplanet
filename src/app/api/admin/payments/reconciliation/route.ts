import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { getOdooClient } from '@/lib/odoo/client'
import { dedupInflight } from '@/lib/odoo/inflightCache'
import {
  scoreMatch,
  type MatchConfidence,
} from '@/lib/payments/reconciliationMatch'
import type {
  ReconciliationCandidate,
  FirestorePaymentSummary,
  OdooPaymentSummary,
  ReconciliationGetResponse,
} from '@/schemas/reconciliationSchema'

const PAYMENTS_COLLECTION = 'payments'
const RECON_LOG_COLLECTION = 'paymentReconciliationLog'
const ODOO_PAYMENT_FIELDS = [
  'id',
  'name',
  'memo',
  'amount',
  'date',
  'partner_id',
  'state',
  'journal_id',
] as const

interface FirestorePaymentDoc {
  id: string
  orderId?: string | null
  agentId?: string | null
  agentName?: string | null
  clientName?: string | null
  amountCents?: number
  paymentMethod?: string
  date?: FirebaseFirestore.Timestamp | string | null
  odooPaymentId?: number | null
}

interface OdooPaymentRaw {
  id: number
  name?: string | false
  memo?: string | false
  amount: number
  date: string | false
  partner_id: [number, string] | false
  state: string
  journal_id: [number, string] | false
}

function fsDateYmd(date: FirestorePaymentDoc['date']): string | null {
  if (!date) return null
  if (typeof date === 'string') return date.slice(0, 10)
  if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    return date.toDate().toISOString().slice(0, 10)
  }
  return null
}

function tupleToParts(t: [number, string] | false): { id: number | null; name: string | null } {
  if (!t || !Array.isArray(t)) return { id: null, name: null }
  return { id: t[0] ?? null, name: t[1] ?? null }
}

async function fetchAllOdooPayments(): Promise<OdooPaymentRaw[]> {
  const client = getOdooClient()
  const all: OdooPaymentRaw[] = []
  const pageSize = 200
  let offset = 0
  while (true) {
    const batch = (await client.searchRead(
      'account.payment',
      [['state', 'in', ['draft', 'in_process', 'paid']]],
      [...ODOO_PAYMENT_FIELDS],
      { offset, limit: pageSize },
    )) as unknown as OdooPaymentRaw[]
    if (batch.length === 0) break
    all.push(...batch)
    if (batch.length < pageSize) break
    offset += pageSize
    if (offset > 5000) break // safety guard
  }
  return all
}

function buildFsSummary(fs: FirestorePaymentDoc): FirestorePaymentSummary {
  const warnings: string[] = []
  if (!fs.clientName) warnings.push('missing_clientName')
  const amountCents = fs.amountCents ?? 0
  return {
    firestoreId: fs.id,
    partnerName: fs.clientName ?? null,
    clientName: fs.clientName ?? null,
    agentName: fs.agentName ?? null,
    amount: amountCents / 100,
    amountCents,
    paymentDate: fsDateYmd(fs.date),
    paymentMethod: fs.paymentMethod ?? null,
    orderId: fs.orderId ?? null,
    warnings,
  }
}

function buildOdooSummary(o: OdooPaymentRaw): OdooPaymentSummary {
  const partner = tupleToParts(o.partner_id)
  const journal = tupleToParts(o.journal_id)
  return {
    odooId: o.id,
    partnerId: partner.id,
    partnerName: partner.name,
    amount: o.amount,
    date: typeof o.date === 'string' ? o.date : null,
    journalId: journal.id,
    journalName: journal.name,
    state: o.state,
    memo: typeof o.memo === 'string' ? o.memo : null,
  }
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission('payments:verify')

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status') ?? 'pending'
    const agentId = searchParams.get('agentId')
    const tripId = searchParams.get('tripId')

    // Cargar pagos Firestore (filtros en memoria si vienen tripId/agentId)
    let fsQuery: FirebaseFirestore.Query = adminDb.collection(PAYMENTS_COLLECTION)
    if (agentId) fsQuery = fsQuery.where('agentId', '==', agentId)
    const fsSnap = await fsQuery.get()
    let fsDocs: FirestorePaymentDoc[] = fsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FirestorePaymentDoc, 'id'>) }))

    if (tripId) {
      // Filtrar por tripId requiere lookup en orders
      const orderIds = Array.from(new Set(fsDocs.map((p) => p.orderId).filter((x): x is string => !!x)))
      if (orderIds.length > 0) {
        const orderSnaps = await Promise.all(
          orderIds.map((id) => adminDb.collection('orders').doc(id).get()),
        )
        const ordersByTrip = new Set<string>(
          orderSnaps.filter((s) => s.exists && s.data()?.tripId === tripId).map((s) => s.id),
        )
        fsDocs = fsDocs.filter((p) => p.orderId && ordersByTrip.has(p.orderId))
      } else {
        fsDocs = []
      }
    }

    // Filtrar matched vs pending
    const matchedCount = fsDocs.filter((p) => p.odooPaymentId != null).length
    let candidates: FirestorePaymentDoc[]
    if (status === 'matched') {
      candidates = fsDocs.filter((p) => p.odooPaymentId != null)
    } else {
      candidates = fsDocs.filter((p) => p.odooPaymentId == null)
    }

    // Cargar log de rechazos para filtrar pares rejected
    const rejectedSnap = await adminDb
      .collection(RECON_LOG_COLLECTION)
      .where('action', '==', 'rejected')
      .get()
    const rejectedPairs = new Set<string>()
    for (const r of rejectedSnap.docs) {
      const d = r.data()
      if (d.firestorePaymentId && d.odooPaymentId) {
        rejectedPairs.add(`${d.firestorePaymentId}|${d.odooPaymentId}`)
      }
    }

    // Cargar pagos Odoo (dedup + 30s cache: la UI puede fan-out por StrictMode/HMR/focus)
    const odooPayments = await dedupInflight(
      'odoo:reconciliation:allPayments',
      fetchAllOdooPayments,
      30_000,
    )

    const buckets = {
      high: [] as ReconciliationCandidate[],
      medium: [] as ReconciliationCandidate[],
      low: [] as ReconciliationCandidate[],
      none: [] as FirestorePaymentSummary[],
    }

    for (const fs of candidates) {
      const fsSummary = buildFsSummary(fs)

      let best: { odoo: OdooPaymentRaw; score: ReturnType<typeof scoreMatch>; confidence: MatchConfidence } | null = null
      for (const o of odooPayments) {
        if (status === 'matched' && fs.odooPaymentId !== o.id) continue
        if (rejectedPairs.has(`${fs.id}|${o.id}`)) continue
        const score = scoreMatch({
          firestore: {
            partnerName: fsSummary.partnerName,
            amount: fsSummary.amount,
            dateYmd: fsSummary.paymentDate,
          },
          odoo: {
            partnerName: tupleToParts(o.partner_id).name,
            amount: o.amount,
            dateYmd: typeof o.date === 'string' ? o.date : null,
          },
        })
        if (score.confidence === 'none') continue
        if (!best || rankConf(score.confidence) > rankConf(best.confidence) || (rankConf(score.confidence) === rankConf(best.confidence) && score.diff.partnerJaccard > best.score.diff.partnerJaccard)) {
          best = { odoo: o, score, confidence: score.confidence }
        }
      }

      if (!best || best.confidence === 'none') {
        buckets.none.push(fsSummary)
        continue
      }

      const candidate: ReconciliationCandidate = {
        firestoreId: fs.id,
        firestorePayment: fsSummary,
        odooId: best.odoo.id,
        odooPayment: buildOdooSummary(best.odoo),
        diff: best.score.diff,
        confidence: best.confidence as 'high' | 'medium' | 'low',
        reasons: best.score.reasons,
        warnings: fsSummary.warnings,
      }
      if (best.confidence === 'high') buckets.high.push(candidate)
      else if (best.confidence === 'medium') buckets.medium.push(candidate)
      else buckets.low.push(candidate)
    }

    const response: ReconciliationGetResponse = {
      generatedAt: new Date().toISOString(),
      summary: {
        high: buckets.high.length,
        medium: buckets.medium.length,
        low: buckets.low.length,
        none: buckets.none.length,
        matched: matchedCount,
      },
      buckets,
    }

    return NextResponse.json(response)
  } catch (error) {
    return handleApiError(error)
  }
}

function rankConf(c: MatchConfidence): number {
  if (c === 'high') return 3
  if (c === 'medium') return 2
  if (c === 'low') return 1
  return 0
}
