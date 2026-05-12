import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { getOdooClient } from '@/lib/odoo/client'
import { groupClusters, type OdooPaymentRow } from '@/lib/payments/duplicateClustering'
import type { DuplicatesGetResponse } from '@/schemas/dedupSchema'

const ODOO_PAYMENT_FIELDS = [
  'id',
  'name',
  'ref',
  'amount',
  'date',
  'partner_id',
  'state',
  'journal_id',
  'x_dup_status',
  'x_canonical_payment_id',
] as const

interface OdooPaymentRaw {
  id: number
  name?: string | false
  ref?: string | false
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
    ref: typeof o.ref === 'string' ? o.ref : null,
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

export async function GET() {
  try {
    await requirePermission('payments:verify')
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
    const clusters = groupClusters(rows)

    const summary = {
      totalClusters: clusters.length,
      unmarked: clusters.filter((c) => c.currentState === 'unmarked').length,
      canonicalSet: clusters.filter((c) => c.currentState === 'canonical_set').length,
      inconsistent: clusters.filter((c) => c.currentState === 'inconsistent').length,
    }

    const response: DuplicatesGetResponse = {
      generatedAt: new Date().toISOString(),
      summary,
      clusters,
    }
    return NextResponse.json(response)
  } catch (error) {
    return handleApiError(error)
  }
}
