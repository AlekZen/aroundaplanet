/**
 * Story 9.3 — Webhook outgoing fast-path (Automation Rule Odoo → Firestore).
 *
 * Recibe POST con header `X-Odoo-Signature` = HMAC-SHA256(secret, rawBody).
 * Verifica firma constant-time, parsea con Zod, invoca el MISMO `processOdooPayment`
 * que usa el polling — idempotente vía merge:true + lookups por odooPaymentId.
 *
 * Decisión: await inline antes de responder (vs fire-and-forget).
 * En Cloud Run, async work post-response queda sin CPU garantizado;
 * el procesamiento de 1 payment es ~200-500ms y cabe en p99 del request lifecycle.
 * Si excede, el cliente Odoo timeout no es catastrófico — el polling cubre la próxima vuelta.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { processOdooPayment, type OdooPaymentRow } from '@/lib/odoo/sync/pull-payments'
import { odooWebhookPaymentSchema } from '@/schemas/odooWebhookPaymentSchema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIGNATURE_HEADER = 'x-odoo-signature'
const SYNCLOG_COLLECTION = 'syncLog'

function getValidSecrets(): string[] {
  const out: string[] = []
  const cur = process.env.ODOO_WEBHOOK_SECRET
  const prev = process.env.ODOO_WEBHOOK_SECRET_PREV
  if (cur) out.push(cur)
  if (prev) out.push(prev)
  return out
}

function verifyHmac(rawBody: string, signature: string | null, secrets: string[]): boolean {
  if (!signature) return false
  const provBuf = Buffer.from(signature, 'hex')
  if (!provBuf.length) return false
  for (const secret of secrets) {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest()
    if (expected.length !== provBuf.length) continue
    if (crypto.timingSafeEqual(expected, provBuf)) return true
  }
  return false
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get(SIGNATURE_HEADER)
  const secrets = getValidSecrets()

  if (!secrets.length || !verifyHmac(rawBody, signature, secrets)) {
    // Log rechazo (best effort — no detener si falla)
    try {
      await adminDb
        .collection(SYNCLOG_COLLECTION)
        .doc(`webhookRejected-${Date.now()}`)
        .set({
          reason: 'invalid_signature',
          headers: { signaturePresent: !!signature },
          bodyLength: rawBody.length,
          at: FieldValue.serverTimestamp(),
        })
    } catch {
      // ignore
    }
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid signature', retryable: false },
      { status: 401 },
    )
  }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: 'invalid JSON body', retryable: false },
      { status: 400 },
    )
  }

  const validated = odooWebhookPaymentSchema.safeParse(parsedBody)
  if (!validated.success) {
    try {
      await adminDb
        .collection(SYNCLOG_COLLECTION)
        .doc(`webhookMalformed-${Date.now()}`)
        .set({
          reason: 'schema_validation_failed',
          issues: validated.error.issues.slice(0, 10),
          at: FieldValue.serverTimestamp(),
        })
    } catch {
      // ignore
    }
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: 'payload validation failed', retryable: false },
      { status: 400 },
    )
  }

  const odooRow = webhookToRow(validated.data)
  const runId = `webhook-${Date.now()}`

  try {
    // Await inline: ~200-500ms p99, cabe en request lifecycle.
    // El polling redundante cubre cualquier drop o timeout.
    const result = await processOdooPayment(odooRow, {
      runId,
      source: 'webhook',
      lastCursor: odooRow.write_date, // cursor = el mismo write_date (resolución conflict: AC4 LWW)
    })

    return NextResponse.json({ ok: true, runId, outcome: result.outcome })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    try {
      await adminDb
        .collection(SYNCLOG_COLLECTION)
        .doc(`webhookFailed-${runId}`)
        .set({
          runId,
          odooPaymentId: odooRow.id,
          error: message.slice(0, 2000),
          at: FieldValue.serverTimestamp(),
        })
    } catch {
      // ignore
    }
    // Responder 200 igualmente para que Odoo no retry-loop;
    // el polling cubre. (Cloud Scheduler tampoco retriaría.)
    return NextResponse.json(
      { ok: false, runId, error: 'processing failed; polling will reconcile' },
      { status: 200 },
    )
  }
}

function webhookToRow(
  w: import('@/schemas/odooWebhookPaymentSchema').OdooWebhookPayment,
): OdooPaymentRow {
  return {
    id: w.id,
    state: w.state,
    journal_id: normalizeMany2One(w.journal_id),
    partner_id: normalizeMany2One(w.partner_id),
    amount: w.amount,
    date: w.date,
    memo: w.memo ?? null,
    reconciled_invoice_ids: w.reconciled_invoice_ids ?? [],
    write_date: w.write_date,
    x_firebase_payment_id: w.x_firebase_payment_id ?? null,
    x_firebase_agent_uid: w.x_firebase_agent_uid ?? null,
  }
}

function normalizeMany2One(
  v: import('@/schemas/odooWebhookPaymentSchema').OdooMany2One | null | undefined,
): [number, string] | number | null {
  if (v == null) return null
  if (Array.isArray(v)) return v
  return v
}
