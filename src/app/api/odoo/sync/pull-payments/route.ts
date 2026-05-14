/**
 * Story 9.3 — Endpoint POST /api/odoo/sync/pull-payments
 *
 * Disparado por Cloud Scheduler cada 15 min con header `X-Scheduler-Secret`.
 * Body opcional: `{ "bootstrapFromEpoch": true }` para reescribir cursor a epoch
 * (runbook 9-3 documenta el uso).
 *
 * Códigos:
 *  - 401 → secret inválido o ausente
 *  - 200 → run OK (puede tener summary con errores parciales)
 *  - 503 → Odoo no respondió / error transitorio (Scheduler reintenta)
 */

import { NextRequest, NextResponse } from 'next/server'
import { pullOdooPayments } from '@/lib/odoo/sync/pull-payments'
import { verifySecret } from '@/lib/odoo/sync'
import { BOOTSTRAP_EPOCH_CURSOR } from '@/schemas/syncCursorSchema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // segundos — Cloud Run/App Hosting cap

const SCHEDULER_SECRET_HEADER = 'x-scheduler-secret'

export async function POST(request: NextRequest) {
  const provided = request.headers.get(SCHEDULER_SECRET_HEADER)
  const validSecrets = [
    process.env.ODOO_PULL_SCHEDULER_SECRET,
    process.env.ODOO_PULL_SCHEDULER_SECRET_PREV,
  ]

  if (!verifySecret(provided, validSecrets)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Invalid scheduler secret', retryable: false },
      { status: 401 },
    )
  }

  let body: { bootstrapFromEpoch?: boolean } = {}
  try {
    body = (await request.json()) as { bootstrapFromEpoch?: boolean }
  } catch {
    // body opcional
  }

  try {
    const result = await pullOdooPayments({
      cursorOverride: body.bootstrapFromEpoch ? BOOTSTRAP_EPOCH_CURSOR : undefined,
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          code: 'PULL_FAILED',
          message: result.error ?? 'pull failed',
          retryable: true,
          runId: result.runId,
          summary: result.summary,
        },
        { status: 503 },
      )
    }

    return NextResponse.json({
      ok: true,
      runId: result.runId,
      summary: result.summary,
      newCursor: result.newCursor,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { code: 'PULL_UNEXPECTED', message, retryable: true },
      { status: 503 },
    )
  }
}
