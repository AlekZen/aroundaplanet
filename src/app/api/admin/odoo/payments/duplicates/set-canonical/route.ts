import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { getOdooClient } from '@/lib/odoo/client'
import { setCanonicalBodySchema } from '@/schemas/dedupSchema'

const DEDUP_LOG_COLLECTION = 'paymentDedupLog'

const ODOO_PAYMENT_FIELDS_VERIFY = [
  'id',
  'amount',
  'date',
  'partner_id',
  'x_dup_status',
  'x_canonical_payment_id',
] as const

interface OdooPaymentRaw {
  id: number
  amount: number
  date: string | false
  partner_id: [number, string] | false
  x_dup_status?: 'canonico' | 'secundario' | false
  x_canonical_payment_id?: [number, string] | false
}

function tupleId(t: [number, string] | false | undefined): number | null {
  if (!t || !Array.isArray(t)) return null
  return t[0] ?? null
}

export async function POST(request: NextRequest) {
  try {
    const claims = await requirePermission('payments:verify')
    const body = await request.json()
    const parsed = setCanonicalBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos invalidos', retryable: false },
        { status: 400 },
      )
    }
    const { clusterId, canonicalOdooId, memberOdooIds } = parsed.data

    const client = getOdooClient()

    // Pre-flight: read members
    const preMembers = (await client.read('account.payment', memberOdooIds, [
      ...ODOO_PAYMENT_FIELDS_VERIFY,
    ])) as unknown as OdooPaymentRaw[]

    if (preMembers.length !== memberOdooIds.length) {
      return NextResponse.json(
        { code: 'invalid_cluster', message: 'Algunos miembros ya no existen en Odoo', retryable: false },
        { status: 400 },
      )
    }

    // Verify same partner + amount within ±$1 + date within ±3d
    const partners = new Set(preMembers.map((m) => tupleId(m.partner_id)))
    if (partners.size !== 1 || partners.has(null)) {
      return NextResponse.json(
        { code: 'invalid_cluster', message: 'Miembros no comparten partner_id', retryable: false },
        { status: 400 },
      )
    }
    const amounts = preMembers.map((m) => m.amount)
    if (Math.max(...amounts) - Math.min(...amounts) > 1) {
      return NextResponse.json(
        { code: 'invalid_cluster', message: 'Miembros difieren en monto >$1', retryable: false },
        { status: 400 },
      )
    }
    const dates = preMembers
      .map((m) => (typeof m.date === 'string' ? new Date(m.date + 'T00:00:00Z').getTime() : NaN))
      .filter((t) => !Number.isNaN(t))
    if (dates.length !== preMembers.length || (Math.max(...dates) - Math.min(...dates)) / 86_400_000 > 3) {
      return NextResponse.json(
        { code: 'invalid_cluster', message: 'Miembros difieren en fecha >3d', retryable: false },
        { status: 400 },
      )
    }

    // Already marked?
    const anyMarked = preMembers.some((m) => m.x_dup_status === 'canonico' || m.x_dup_status === 'secundario')
    if (anyMarked) {
      return NextResponse.json(
        { code: 'already_set', message: 'Cluster ya tiene canónico definido', retryable: false },
        { status: 409 },
      )
    }

    // === Odoo writes — SOLO 2 fields ===
    // Canonical
    await client.write('account.payment', [canonicalOdooId], {
      x_dup_status: 'canonico',
      x_canonical_payment_id: false,
    })
    // Secondaries
    const secondaryIds = memberOdooIds.filter((id) => id !== canonicalOdooId)
    for (const id of secondaryIds) {
      await client.write('account.payment', [id], {
        x_dup_status: 'secundario',
        x_canonical_payment_id: canonicalOdooId,
      })
    }

    // Post-write verify
    const postMembers = (await client.read('account.payment', memberOdooIds, [
      ...ODOO_PAYMENT_FIELDS_VERIFY,
    ])) as unknown as OdooPaymentRaw[]
    const verifyResult: Record<number, { x_dup_status: string | null; x_canonical_payment_id: number | null }> = {}
    let allConsistent = true
    for (const m of postMembers) {
      const dup = m.x_dup_status === 'canonico' || m.x_dup_status === 'secundario' ? m.x_dup_status : null
      const canRef = tupleId(m.x_canonical_payment_id)
      verifyResult[m.id] = { x_dup_status: dup, x_canonical_payment_id: canRef }
      if (m.id === canonicalOdooId) {
        if (dup !== 'canonico') allConsistent = false
      } else {
        if (dup !== 'secundario' || canRef !== canonicalOdooId) allConsistent = false
      }
    }

    const status: 'success' | 'partial' = allConsistent ? 'success' : 'partial'

    // Audit log
    const logRef = adminDb.collection(DEDUP_LOG_COLLECTION).doc()
    await logRef.create({
      clusterId,
      canonicalOdooId,
      secondaryOdooIds: secondaryIds,
      memberOdooIds,
      adminUid: claims.uid,
      action: 'set_canonical',
      status,
      verifyResult,
      createdAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json(
      {
        clusterId,
        canonicalOdooId,
        secondaryOdooIds: secondaryIds,
        status,
        verifyResult,
        logId: logRef.id,
      },
      { status: status === 'partial' ? 207 : 200 },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
