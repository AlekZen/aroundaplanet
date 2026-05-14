/**
 * Story 9.3 — Pull Odoo → Firestore (mirror read-only).
 *
 * Refleja en Firestore los cambios contables que Paloma realiza en Odoo
 * (state, journal, reconciliación, cancelación, memo), SIN tocar jamás campos
 * Firestore-owned (status, agentId, clientName, receiptUrl, ocrData, etc).
 *
 * Disparos:
 *  - Polling (Cloud Scheduler → POST /api/odoo/sync/pull-payments) cada 15min
 *  - Webhook outgoing (Automation Rule Odoo → POST /api/odoo/webhook/payment) fast-path
 *
 * Ambos comparten `processOdooPayment`. Idempotencia: `set({...}, { merge: true })`
 * + match por `x_firebase_payment_id` o `odooPaymentId`.
 *
 * Invariante crítica: TODA escritura Firestore pasa por `writeMirror()`, que
 * llama `assertOnlyMirrorFields()`. Cualquier campo fuera de la whitelist hace
 * fallar el run con error explícito.
 */

import 'server-only'
import { FieldValue, Timestamp, type Firestore, type DocumentReference } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { getOdooClient, type OdooClient } from '@/lib/odoo/client'
import {
  odooPaymentStateSchema,
  type OdooPaymentState,
  LWW_PAYMENT_FIELDS,
} from '@/schemas/paymentSchema'
import {
  prefetchIrModelDataByResIds,
  extractFirestoreIdFromExtId,
  type IrModelDataRow,
} from './index'
import { detectLwwConflict, type LwwSubdoc } from './conflicts'
import { toEpochMs } from './time'
import { unpackMany2One } from '@/schemas/odooWebhookPaymentSchema'
import {
  paymentAlertDocId,
  type CreatePaymentAlert,
} from '@/schemas/paymentAlertSchema'
import {
  defaultCursor24hAgo,
  formatOdooDateTime,
} from '@/schemas/syncCursorSchema'

// =====================================================================
// Constantes
// =====================================================================

export const PULL_PAGE_SIZE = 200
export const PULL_HARD_TIMEOUT_MS = 4 * 60 * 1000
export const ODOO_PAYMENT_FIELDS = [
  'id',
  'state',
  'journal_id',
  'partner_id',
  'amount',
  'date',
  'memo',
  'reconciled_invoice_ids',
  'write_date',
  'x_firebase_payment_id',
  'x_firebase_agent_uid',
] as const

const PAYMENTS_COLLECTION = 'payments'
const SYNC_CURSORS_COLLECTION = 'syncCursors'
const PAYMENT_ALERTS_COLLECTION = 'paymentAlerts'
const PAYMENT_CONFLICTS_COLLECTION = 'paymentConflicts'
const SYNCLOG_COLLECTION = 'syncLog'
const CURSOR_DOC_ID = 'odooPayments'

/**
 * Whitelist EXACTA de campos top-level que el pull puede escribir en payments/{id}.
 *
 * NOTA importante sobre LWW: firebase-admin `set({...}, {merge: true})` trata claves
 * con punto como literales, NO como FieldPath (a diferencia de `update()`). Por eso
 * el pull escribe el subobjeto `lww: { memo: {...}, amount: {...} }` completo y
 * confía en el deep-merge de Firestore para no pisar campos hermanos.
 *
 * `assertOnlyMirrorFields` valida que, si `lww` está presente, sus subkeys solo
 * sean `memo | amount | paymentDate`.
 */
export const ALLOWED_MIRROR_FIELDS = new Set<string>([
  'odooState',
  'odooJournalId',
  'odooJournalName',
  'odooReconciled',
  'odooReconciledInvoiceIds',
  'odooCanceledAt',
  'odooSyncedAt',
  'odooLastError',
  'updatedAt',
  'lww',
])

/** Campos Firestore-owned que NUNCA debe tocar el pull. Para mensajes de error. */
export const FORBIDDEN_FIRESTORE_FIELDS = [
  'status',
  'agentId',
  'agentName',
  'clientName',
  'clientId',
  'clientPhone',
  'receiptUrl',
  'ocrData',
  'verifiedBy',
  'verifiedAt',
  'rejectionReason',
  'commissionId',
  'tripId',
  'orderId',
  'paymentMethod',
  'amountCents', // raw cents owned por Firestore — LWW vive en lww.amount
] as const

// =====================================================================
// Tipos públicos
// =====================================================================

export type PullSource = 'polling' | 'webhook' | 'manual'

export interface OdooPaymentRow {
  id: number
  state: string
  journal_id?: [number, string] | number | null
  partner_id?: [number, string] | number | null
  amount: number
  date: string
  memo?: string | null
  reconciled_invoice_ids?: number[]
  write_date: string
  x_firebase_payment_id?: string | null
  x_firebase_agent_uid?: string | null
}

export interface ProcessPaymentContext {
  runId: string
  source: PullSource
  lastCursor: string
  /** Cuando se conoce por adelantado (polling con prefetch). Si null, el processor mira en runtime. */
  extIdRow?: IrModelDataRow | null
}

export interface ProcessPaymentResult {
  outcome: 'updated' | 'noop' | 'unmatched' | 'skipped' | 'validation_failed'
  firestoreId?: string
  conflicts: number
  alertCreated: boolean
  reason?: string
}

export interface PullRunSummary {
  fetched: number
  matched: number
  updated: number
  conflicts: number
  alerts: number
  unmatched: number
  validationFailures: number
  durationMs: number
}

export interface PullOptions {
  /** Override cursor (ej: bootstrap desde epoch). */
  cursorOverride?: string
  /** Para tests: `Date.now()` actual. */
  now?: () => number
  /** Para tests: inyectar runId determinista. */
  runId?: string
  /** Hard timeout. Default 4 min. */
  hardTimeoutMs?: number
}

export interface PullRunResult {
  ok: boolean
  runId: string
  summary: PullRunSummary
  newCursor: string | null
  error?: string
}

// =====================================================================
// Invariante: assertOnlyMirrorFields
// =====================================================================

export function assertOnlyMirrorFields(update: Record<string, unknown>): void {
  for (const key of Object.keys(update)) {
    if (ALLOWED_MIRROR_FIELDS.has(key)) {
      if (key === 'lww') {
        const lww = update.lww as Record<string, unknown> | null | undefined
        if (lww && typeof lww === 'object') {
          for (const sub of Object.keys(lww)) {
            if (!(LWW_PAYMENT_FIELDS as readonly string[]).includes(sub)) {
              throw new MirrorInvariantError(
                `assertOnlyMirrorFields: subkey lww."${sub}" no permitida`,
              )
            }
          }
        }
      }
      continue
    }
    // Bloquear explícitamente Firestore-owned
    if ((FORBIDDEN_FIRESTORE_FIELDS as readonly string[]).includes(key)) {
      throw new MirrorInvariantError(
        `assertOnlyMirrorFields: prohibido escribir campo Firestore-owned "${key}" desde el pull`,
      )
    }
    // Claves con punto son ilegales también — el caller debe usar objeto nested
    if (key.includes('.')) {
      throw new MirrorInvariantError(
        `assertOnlyMirrorFields: clave con punto "${key}" no permitida — usar objeto nested ` +
          `(firebase-admin set+merge no parsea FieldPath en data object)`,
      )
    }
    throw new MirrorInvariantError(
      `assertOnlyMirrorFields: campo "${key}" no está en ALLOWED_MIRROR_FIELDS`,
    )
  }
}

export class MirrorInvariantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MirrorInvariantError'
  }
}

/** Única vía de escritura del módulo pull. Llama assert antes del .set(). */
export async function writeMirror(
  ref: DocumentReference,
  update: Record<string, unknown>,
): Promise<void> {
  assertOnlyMirrorFields(update)
  await ref.set(update, { merge: true })
}

// =====================================================================
// Mapeo Odoo → mirror Firestore (PURO, sin I/O)
// =====================================================================

export interface FirestorePaymentSnapshot {
  id: string
  odooPaymentId?: number | null
  odooState?: OdooPaymentState | string | null
  odooCanceledAt?: unknown
  lww?: Record<string, LwwSubdoc | undefined>
  amountCents?: number | null
  // Solo se lee para detección Tier 3 (no se sobrescribe nunca).
}

export interface MirrorBuildResult {
  /** Update parcial para writeMirror (puede ser {} si todo era noop). */
  update: Record<string, unknown>
  /** Conflictos LWW a encolar (NO se aplican como write). */
  conflicts: Array<{
    field: string
    firestoreValue: unknown
    odooValue: unknown
    firestoreWrittenAt: unknown
    odooWrittenAt: string
  }>
  /** Alerta a crear (idempotente — el caller dedup vía docId). */
  alert?: CreatePaymentAlert
  /** Razones por las que un campo se skipeó (para log/debug). */
  skipped: string[]
}

export function mapOdooToMirror(
  odoo: OdooPaymentRow,
  prev: FirestorePaymentSnapshot | null,
  lastCursor: string,
  runId: string,
): MirrorBuildResult {
  const update: Record<string, unknown> = {}
  const conflicts: MirrorBuildResult['conflicts'] = []
  const skipped: string[] = []
  let alert: CreatePaymentAlert | undefined

  // === state (whitelist con schema Zod) ===
  const stateParsed = odooPaymentStateSchema.safeParse(odoo.state)
  if (stateParsed.success) {
    update.odooState = stateParsed.data
  } else {
    skipped.push(`unknown_state:${odoo.state}`)
  }

  // === journal ===
  const journal = unpackMany2One(odoo.journal_id ?? null)
  if (journal.id != null) {
    update.odooJournalId = journal.id
    if (journal.name != null) update.odooJournalName = journal.name
  }

  // === reconciliación ===
  const recIds = odoo.reconciled_invoice_ids ?? []
  update.odooReconciledInvoiceIds = recIds
  update.odooReconciled = stateParsed.success && stateParsed.data === 'paid' && recIds.length > 0

  // === odooCanceledAt: solo en transición → 'canceled' ===
  if (stateParsed.success && stateParsed.data === 'canceled') {
    const prevState = prev?.odooState ?? null
    if (prevState !== 'canceled') {
      update.odooCanceledAt = {
        value: odoo.write_date,
        writtenAt: FieldValue.serverTimestamp(),
        source: 'odoo',
      }
      // Alerta para que admin decida (AC5)
      alert = {
        paymentId: '', // lo setea processOdooPayment cuando conoce el firestoreId
        type: 'odoo_canceled',
        odooPaymentId: odoo.id,
        odooState: 'canceled',
        firestoreStatus: null, // mirror no toca status; el alert handler lo lee del doc
        detectedAt: FieldValue.serverTimestamp() as unknown as string,
        runId,
      } satisfies CreatePaymentAlert
    } else if (prev?.odooCanceledAt != null) {
      // Ya estaba canceled — preservar timestamp original
    }
  }

  // === LWW: memo, amount, paymentDate ===
  const lwwPrev = prev?.lww ?? {}

  // memo
  {
    // Odoo XML-RPC retorna `false` para strings vacíos — NO usar `?? ''`.
    const odooMemo = typeof odoo.memo === 'string' ? odoo.memo : ''
    const r = detectLwwConflict({
      field: 'memo',
      firestoreLww: lwwPrev.memo ?? null,
      odooValue: odooMemo,
      odooWriteDate: odoo.write_date,
      lastCursor,
    })
    handleLwwResolution('memo', r, lwwPrev.memo, odooMemo, odoo.write_date, update, conflicts)
  }

  // amount (Odoo es float MXN → centavos int)
  {
    const odooCents = Math.round(Number(odoo.amount) * 100)
    if (Number.isFinite(odooCents)) {
      const r = detectLwwConflict({
        field: 'amount',
        firestoreLww: lwwPrev.amount ?? null,
        odooValue: odooCents,
        odooWriteDate: odoo.write_date,
        lastCursor,
      })
      handleLwwResolution(
        'amount',
        r,
        lwwPrev.amount,
        odooCents,
        odoo.write_date,
        update,
        conflicts,
      )
    } else {
      skipped.push(`amount_nan:${odoo.amount}`)
    }
  }

  // paymentDate (Odoo string YYYY-MM-DD)
  {
    const r = detectLwwConflict({
      field: 'paymentDate',
      firestoreLww: lwwPrev.paymentDate ?? null,
      odooValue: odoo.date,
      odooWriteDate: odoo.write_date,
      lastCursor,
    })
    handleLwwResolution(
      'paymentDate',
      r,
      lwwPrev.paymentDate,
      odoo.date,
      odoo.write_date,
      update,
      conflicts,
    )
  }

  // === bookkeeping mirror ===
  if (Object.keys(update).length > 0) {
    update.odooSyncedAt = FieldValue.serverTimestamp()
    update.odooLastError = null
    update.updatedAt = FieldValue.serverTimestamp()
  }

  return { update, conflicts, alert, skipped }
}

function handleLwwResolution(
  field: 'memo' | 'amount' | 'paymentDate',
  r: ReturnType<typeof detectLwwConflict>,
  firestoreLww: LwwSubdoc | undefined,
  odooValue: unknown,
  odooWriteDate: string,
  update: Record<string, unknown>,
  conflicts: MirrorBuildResult['conflicts'],
) {
  if (r.resolution === 'noop' || r.resolution === 'firestore_wins') return
  if (r.resolution === 'odoo_wins' && r.odooLww) {
    // Construir objeto nested para que firebase-admin set({...}, {merge: true}) deep-merge
    // con cualquier campo hermano existente (`lww.amount` no debe pisar `lww.memo` previo).
    const lwwBucket =
      (update.lww as Record<string, unknown> | undefined) ?? (update.lww = {} as Record<string, unknown>)
    ;(lwwBucket as Record<string, unknown>)[field] = r.odooLww
    return
  }
  if (r.resolution === 'conflict') {
    conflicts.push({
      field,
      firestoreValue: firestoreLww?.value,
      odooValue,
      firestoreWrittenAt: firestoreLww?.writtenAt,
      odooWrittenAt: odooWriteDate,
    })
  }
}

// =====================================================================
// Resolver doc Firestore (3-tier)
// =====================================================================

export interface ResolveResult {
  firestoreId: string | null
  tier: 1 | 2 | 3 | null
}

export async function resolveFirestoreDoc(
  odoo: OdooPaymentRow,
  prefetchedExtId: IrModelDataRow | undefined,
  db: Firestore = adminDb,
): Promise<ResolveResult> {
  // Tier 1: x_firebase_payment_id directo.
  // Odoo XML-RPC retorna `false` para campos string vacíos (NO string vacío). Coerce defensiva.
  const rawCustom = odoo.x_firebase_payment_id
  const customField = typeof rawCustom === 'string' ? rawCustom.trim() : ''
  if (customField) return { firestoreId: customField, tier: 1 }

  // Tier 2: ir.model.data prefetched (lookup por res_id)
  if (prefetchedExtId) {
    if (prefetchedExtId.res_id === 0) return { firestoreId: null, tier: null }
    const fid = extractFirestoreIdFromExtId(prefetchedExtId.name)
    if (fid) return { firestoreId: fid, tier: 2 }
  }

  // Tier 3: query Firestore por odooPaymentId (legacy linked Story 9.1)
  const snap = await db
    .collection(PAYMENTS_COLLECTION)
    .where('odooPaymentId', '==', odoo.id)
    .limit(1)
    .get()
  if (!snap.empty) {
    return { firestoreId: snap.docs[0].id, tier: 3 }
  }

  return { firestoreId: null, tier: null }
}

// =====================================================================
// processOdooPayment (entrypoint compartido polling + webhook)
// =====================================================================

export async function processOdooPayment(
  odoo: OdooPaymentRow,
  ctx: ProcessPaymentContext,
  db: Firestore = adminDb,
): Promise<ProcessPaymentResult> {
  const resolved = await resolveFirestoreDoc(odoo, ctx.extIdRow ?? undefined, db)
  if (!resolved.firestoreId) {
    return { outcome: 'unmatched', conflicts: 0, alertCreated: false }
  }

  const ref = db.collection(PAYMENTS_COLLECTION).doc(resolved.firestoreId)
  const docSnap = await ref.get()
  if (!docSnap.exists) {
    // No crear desde el pull (regla AC2 — 200 legacy fuera de scope).
    return {
      outcome: 'skipped',
      firestoreId: resolved.firestoreId,
      conflicts: 0,
      alertCreated: false,
      reason: 'doc_not_found',
    }
  }

  const prevData = docSnap.data() ?? {}
  const prev: FirestorePaymentSnapshot = {
    id: resolved.firestoreId,
    odooPaymentId: prevData.odooPaymentId ?? null,
    odooState: prevData.odooState ?? null,
    odooCanceledAt: prevData.odooCanceledAt ?? null,
    lww: prevData.lww ?? {},
    amountCents: prevData.amountCents ?? null,
  }

  const build = mapOdooToMirror(odoo, prev, ctx.lastCursor, ctx.runId)

  // Encolar conflictos primero (no bloquea mirror; UI Story 9.6 los resuelve).
  for (const c of build.conflicts) {
    const confRef = db.collection(PAYMENT_CONFLICTS_COLLECTION).doc()
    await confRef.set({
      paymentId: resolved.firestoreId,
      field: c.field,
      firestoreValue: c.firestoreValue ?? null,
      odooValue: c.odooValue ?? null,
      firestoreWrittenAt: c.firestoreWrittenAt ?? null,
      odooWrittenAt: c.odooWrittenAt,
      firestoreSource: 'firestore',
      odooSource: 'odoo',
      detectedAt: FieldValue.serverTimestamp(),
      runId: ctx.runId,
    })
  }

  // Alerta odoo_canceled (idempotente por docId).
  let alertCreated = false
  if (build.alert) {
    const alertDocId = paymentAlertDocId(resolved.firestoreId, build.alert.type)
    const alertRef = db.collection(PAYMENT_ALERTS_COLLECTION).doc(alertDocId)
    const existing = await alertRef.get()
    if (!existing.exists || existing.data()?.status !== 'open') {
      await alertRef.set(
        {
          ...build.alert,
          paymentId: resolved.firestoreId,
          status: 'open',
          firestoreStatus: prevData.status ?? null,
          detectedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      alertCreated = true
    }
  }

  // Mirror update (la única vía con assert).
  if (Object.keys(build.update).length > 0) {
    await writeMirror(ref, build.update)
    return {
      outcome: 'updated',
      firestoreId: resolved.firestoreId,
      conflicts: build.conflicts.length,
      alertCreated,
    }
  }

  return {
    outcome: 'noop',
    firestoreId: resolved.firestoreId,
    conflicts: build.conflicts.length,
    alertCreated,
  }
}

// =====================================================================
// Polling orchestrator
// =====================================================================

export async function pullOdooPayments(
  opts: PullOptions = {},
  client: OdooClient = getOdooClient(),
  db: Firestore = adminDb,
): Promise<PullRunResult> {
  const now = opts.now ?? Date.now
  const runId = opts.runId ?? `pull-${now()}`
  const startMs = now()
  const hardTimeout = opts.hardTimeoutMs ?? PULL_HARD_TIMEOUT_MS

  const summary: PullRunSummary = {
    fetched: 0,
    matched: 0,
    updated: 0,
    conflicts: 0,
    alerts: 0,
    unmatched: 0,
    validationFailures: 0,
    durationMs: 0,
  }

  const cursorRef = db.collection(SYNC_CURSORS_COLLECTION).doc(CURSOR_DOC_ID)
  const cursorSnap = await cursorRef.get()
  const cursorData = cursorSnap.exists ? cursorSnap.data() ?? {} : {}
  const lastCursor: string =
    opts.cursorOverride ??
    (typeof cursorData.lastCursor === 'string' && cursorData.lastCursor
      ? cursorData.lastCursor
      : defaultCursor24hAgo(new Date(now())))

  const unmatched: Array<{
    odooPaymentId: number
    writeDate: string
  }> = []

  try {
    // 1. Fetch delta paginated
    const allRows: OdooPaymentRow[] = []
    let offset = 0
    // Safety cap: 50 páginas = 10k rows. Más que suficiente para un delta de 15min.
    for (let i = 0; i < 50; i++) {
      if (now() - startMs > hardTimeout) throw new Error('partial_run_timeout')
      const rows = (await client.searchRead(
        'account.payment',
        [['write_date', '>', lastCursor]],
        ODOO_PAYMENT_FIELDS as unknown as string[],
        { limit: PULL_PAGE_SIZE, offset, order: 'write_date asc' },
      )) as unknown as OdooPaymentRow[]
      allRows.push(...rows)
      if (rows.length < PULL_PAGE_SIZE) break
      offset += PULL_PAGE_SIZE
    }
    summary.fetched = allRows.length

    if (allRows.length === 0) {
      summary.durationMs = now() - startMs
      await cursorRef.set(
        {
          lastCursor,
          lastRunAt: FieldValue.serverTimestamp(),
          lastRunSummary: summary,
          lastError: null,
        },
        { merge: true },
      )
      return { ok: true, runId, summary, newCursor: lastCursor }
    }

    // 2. Prefetch ir.model.data Tier 2
    const odooIdsWithoutCustom = allRows
      .filter((r) => !(typeof r.x_firebase_payment_id === 'string' && r.x_firebase_payment_id.trim()))
      .map((r) => r.id)
    const extIdMap = odooIdsWithoutCustom.length
      ? await prefetchIrModelDataByResIds(client, odooIdsWithoutCustom)
      : new Map<number, IrModelDataRow>()

    // 3. Procesar cada payment
    let maxWriteDate = lastCursor
    for (const row of allRows) {
      if (now() - startMs > hardTimeout) throw new Error('partial_run_timeout')
      try {
        const result = await processOdooPayment(
          row,
          {
            runId,
            source: 'polling',
            lastCursor,
            extIdRow: extIdMap.get(row.id) ?? null,
          },
          db,
        )
        if (result.outcome === 'unmatched') {
          summary.unmatched += 1
          unmatched.push({ odooPaymentId: row.id, writeDate: row.write_date })
        } else if (result.outcome === 'updated') {
          summary.updated += 1
          summary.matched += 1
        } else if (result.outcome === 'noop') {
          summary.matched += 1
        }
        summary.conflicts += result.conflicts
        if (result.alertCreated) summary.alerts += 1
      } catch (err) {
        if (err instanceof MirrorInvariantError) throw err
        summary.validationFailures += 1
        try {
          await db
            .collection(SYNCLOG_COLLECTION)
            .doc(`pull-${runId}-${row.id}`)
            .set(
              {
                runId,
                odooPaymentId: row.id,
                error: err instanceof Error ? err.message : String(err),
                at: FieldValue.serverTimestamp(),
              },
              { merge: true },
            )
        } catch {
          // best effort log
        }
      }
      if (row.write_date > maxWriteDate) maxWriteDate = row.write_date
    }

    // 4. Persistir cursor solo si todo OK
    summary.durationMs = now() - startMs
    await cursorRef.set(
      {
        lastCursor: maxWriteDate,
        lastRunAt: FieldValue.serverTimestamp(),
        lastRunSummary: summary,
        lastError: null,
        unmatchedSample: unmatched.slice(0, 20),
      },
      { merge: true },
    )

    return { ok: true, runId, summary, newCursor: maxWriteDate }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    summary.durationMs = now() - startMs
    try {
      await cursorRef.set(
        {
          // NO avanzamos lastCursor en error
          lastRunAt: FieldValue.serverTimestamp(),
          lastError: message.slice(0, 2000),
          lastErrorAt: FieldValue.serverTimestamp(),
          lastRunSummary: summary,
        },
        { merge: true },
      )
    } catch {
      // best effort
    }
    if (err instanceof MirrorInvariantError) throw err
    return { ok: false, runId, summary, newCursor: null, error: message }
  }
}

// =====================================================================
// Re-exports / helpers para tests
// =====================================================================

export {
  formatOdooDateTime,
  defaultCursor24hAgo,
}

/** Test-only helper: convierte un FieldValue.serverTimestamp() en un Timestamp concreto. */
export function nowAsTimestamp(): Timestamp {
  return Timestamp.now()
}
