import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { getOdooClient } from '@/lib/odoo/client'
import { dedupInflight } from '@/lib/odoo/inflightCache'
import { groupClusters, type OdooPaymentRow } from '@/lib/payments/duplicateClustering'
import {
  enrichDuplicatePayments,
  applyEnrichment,
  computeClusterFlags,
} from '@/lib/payments/duplicateEnrichment'
import type { DuplicatesGetResponse, DuplicateClusterDto } from '@/schemas/dedupSchema'

const ODOO_PAYMENT_FIELDS = [
  'id',
  'name',
  'memo',
  'amount',
  'date',
  'partner_id',
  'state',
  'journal_id',
  'x_dup_status',
  'x_canonical_payment_id',
] as const

const DISMISSALS_COLLECTION = 'paymentDedupDismissals'
const FLAGS_COLLECTION = 'paymentDedupFlags'

interface OdooPaymentRaw {
  id: number
  name?: string | false
  memo?: string | false
  amount: number
  date: string | false
  partner_id: [number, string] | false
  state: string
  journal_id: [number, string] | false
  x_dup_status?: 'canonico' | 'secundario' | false
  x_canonical_payment_id?: [number, string] | false
}

function tupleId(t: [number, string] | false | undefined): number | null {
  if (!t || !Array.isArray(t)) return null
  return t[0] ?? null
}
function tupleName(t: [number, string] | false | undefined): string | null {
  if (!t || !Array.isArray(t)) return null
  return t[1] ?? null
}

function mapRow(o: OdooPaymentRaw): OdooPaymentRow {
  return {
    id: o.id,
    name: typeof o.name === 'string' ? o.name : null,
    memo: typeof o.memo === 'string' ? o.memo : null,
    amount: o.amount,
    date: typeof o.date === 'string' ? o.date : null,
    partnerId: tupleId(o.partner_id),
    partnerName: tupleName(o.partner_id),
    journalId: tupleId(o.journal_id),
    journalName: tupleName(o.journal_id),
    state: o.state,
    xDupStatus: o.x_dup_status === 'canonico' || o.x_dup_status === 'secundario' ? o.x_dup_status : null,
    xCanonicalPaymentId: tupleId(o.x_canonical_payment_id) ?? null,
  }
}

interface RawPayload {
  generatedAt: string
  enrichedClusters: DuplicateClusterDto[]
}

/** Fetcha Odoo + enriquece clusters. Sin Firestore dismissals/flags (esos se aplican en GET). */
async function fetchEnrichedClusters(): Promise<RawPayload> {
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
    if (offset > 5000) break
  }

  const rows = all.map(mapRow)
  const baseClusters = groupClusters(rows)

  // Solo enriquecemos los rows que están en clusters (no los 175 Odoo-only)
  const clusterPayments = baseClusters.flatMap((c) => c.members)
  const enrichmentResult = await enrichDuplicatePayments(client, clusterPayments)

  const enrichedClusters: DuplicateClusterDto[] = baseClusters.map((c) => {
    const enrichedMembers = applyEnrichment(c.members, enrichmentResult)
    const flags = computeClusterFlags(enrichedMembers)
    return {
      ...c,
      members: enrichedMembers,
      sameTrip: flags.sameTrip,
      sameAgent: flags.sameAgent,
      maxDateDiffDays: flags.maxDateDiffDays,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    enrichedClusters,
  }
}

interface FsFlagDoc {
  flaggedBy: string
  flaggedAt: FirebaseFirestore.Timestamp
  note?: string | null
  memberOdooIds: number[]
}
interface FsDismissalDoc {
  dismissedBy: string
  dismissedAt: FirebaseFirestore.Timestamp
  reason?: string | null
  memberOdooIds: number[]
}

/** Score para ordenar por riesgo desc. Higher = más sospechoso = más arriba. */
function clusterRiskScore(c: DuplicateClusterDto): number {
  let s = 0
  if (c.flagged) s += 1000
  if (c.sameTrip === true) s += 100
  if (c.sameAgent === true) s += 50
  if (c.sameTrip === false) s -= 20
  return s
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission('payments:verify')
    const { searchParams } = request.nextUrl
    const includeDismissed = searchParams.get('includeDismissed') === 'true'

    const raw = await dedupInflight(
      'odoo:duplicates:payments:v2',
      fetchEnrichedClusters,
      30_000,
    )

    // Cargar dismissals + flags Firestore (no cacheamos, escrituras son inmediatas)
    const [dismissalsSnap, flagsSnap] = await Promise.all([
      adminDb.collection(DISMISSALS_COLLECTION).get(),
      adminDb.collection(FLAGS_COLLECTION).get(),
    ])
    const dismissed = new Set(dismissalsSnap.docs.map((d) => d.id))
    const flags = new Map<string, FsFlagDoc>()
    for (const d of flagsSnap.docs) flags.set(d.id, d.data() as FsFlagDoc)

    // Marcar + filtrar
    let clusters: DuplicateClusterDto[] = raw.enrichedClusters.map((c) => {
      const flag = flags.get(c.clusterId)
      return {
        ...c,
        dismissed: dismissed.has(c.clusterId),
        flagged: !!flag,
        flagNote: flag?.note ?? null,
      }
    })
    if (!includeDismissed) {
      clusters = clusters.filter((c) => !c.dismissed)
    }

    // Sort por riesgo desc
    clusters = clusters.sort((a, b) => clusterRiskScore(b) - clusterRiskScore(a))

    const summary = {
      totalClusters: clusters.length,
      unmarked: clusters.filter((c) => c.currentState === 'unmarked').length,
      canonicalSet: clusters.filter((c) => c.currentState === 'canonical_set').length,
      inconsistent: clusters.filter((c) => c.currentState === 'inconsistent').length,
    }

    const response: DuplicatesGetResponse = {
      generatedAt: raw.generatedAt,
      summary,
      clusters,
    }
    return NextResponse.json(response)
  } catch (error) {
    return handleApiError(error)
  }
}
