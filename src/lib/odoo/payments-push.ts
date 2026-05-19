/**
 * Story 9.2 — Push idempotente Firestore → Odoo `account.payment`.
 *
 * Patrón 3-call invertido validado en spike 9.0b:
 *  1) lookup `ir.model.data` por (module, name)
 *  2) reservar ir.model.data con `res_id=0` (UNIQUE serializa carrera)
 *  3) crear `account.payment`
 *  4) write `ir.model.data.res_id = newId` con retry 1s→2s→4s
 *
 * Cualquier mid-flight failure es recuperable: el siguiente intento ve el slot
 * reservado y avanza desde ahí sin duplicar el payment.
 *
 * El módulo expone DOS capas:
 *  - `pushPaymentToOdoo` (CONTRATO spike 9.0b, partner/journal ya resueltos)
 *  - `syncVerifiedPaymentToOdoo` (orquestador: resuelve partner+journal,
 *    actualiza mirror Firestore, NUNCA throw — captura todo y retorna result).
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { getOdooClient, OdooClient } from '@/lib/odoo/client'
import { AppError } from '@/lib/errors/AppError'
import type { OdooDomain } from '@/types/odoo'
import type { PaymentMethod } from '@/schemas/paymentSchema'
import { syncReceiptToOdoo } from '@/lib/odoo/sync/receipt-attachment'
import { paymentAlertDocId } from '@/schemas/paymentAlertSchema'

// =====================================================================
// Constantes
// =====================================================================

export const EXTID_MODULE = '__aroundaplanet__'
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const
const UNIQUE_VIOLATION_MARKERS = [
  'ir_model_data_module_name_uniq_index',
  'duplicate key value',
]
const PAYMENTS_COLLECTION = 'payments'
const SYNCLOG_COLLECTION = 'syncLog'
const PAYMENT_ALERTS_COLLECTION = 'paymentAlerts'
const MAX_ERROR_LENGTH = 2000

// =====================================================================
// Capa 1 — Contrato spike 9.0b
// =====================================================================

export interface PushPaymentInput {
  firestoreId: string
  partnerId: number
  journalId: number
  amount: number // unidades enteras (MXN), NO centavos
  date: string // 'YYYY-MM-DD'
  memo: string
  paymentType?: 'inbound' | 'outbound'
  // Custom fields Odoo Studio (Story 9.7)
  firebaseAgentUid?: string | null
  ocrConfidence?: number | null
}

export interface PushPaymentResult {
  odooPaymentId: number
  extIdRecordId: number | null
  isNew: boolean
  orphan: boolean
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function isUniqueViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return UNIQUE_VIOLATION_MARKERS.some((m) => msg.includes(m))
}

async function lookupExtId(client: OdooClient, extIdName: string) {
  const rows = await client.searchRead(
    'ir.model.data',
    [
      ['module', '=', EXTID_MODULE],
      ['name', '=', extIdName],
      ['model', '=', 'account.payment'],
    ],
    ['res_id'],
    { limit: 1 },
  )
  if (!rows.length) return null
  return { extIdRecordId: rows[0].id as number, resId: rows[0].res_id as number }
}

/**
 * Patrón 3-call invertido (contrato spike 9.0b).
 * NO captura errores no-idempotentes — el orquestador los traduce a Firestore mirror.
 */
export async function pushPaymentToOdoo(input: PushPaymentInput): Promise<PushPaymentResult> {
  const client = getOdooClient()
  const extIdName = `payment_${input.firestoreId}`

  // 1) Lookup idempotente.
  const existing = await lookupExtId(client, extIdName)
  if (existing && existing.resId > 0) {
    return { odooPaymentId: existing.resId, extIdRecordId: existing.extIdRecordId, isNew: false, orphan: false }
  }

  // 2) Reservar slot (UNIQUE Postgres serializa la carrera).
  let extIdRecordId: number
  if (existing && existing.resId === 0) {
    extIdRecordId = existing.extIdRecordId
  } else {
    try {
      extIdRecordId = await client.create('ir.model.data', {
        module: EXTID_MODULE,
        name: extIdName,
        model: 'account.payment',
        res_id: 0,
        noupdate: true,
      })
    } catch (err) {
      if (isUniqueViolation(err)) {
        const winner = await lookupExtId(client, extIdName)
        if (winner && winner.resId > 0) {
          return { odooPaymentId: winner.resId, extIdRecordId: winner.extIdRecordId, isNew: false, orphan: false }
        }
        if (!winner) throw new AppError('ODOO_RACE_INCONSISTENT', 'UNIQUE violation sin lookup hit', 500, true)
        extIdRecordId = winner.extIdRecordId
      } else {
        throw err
      }
    }
  }

  // 3) Crear account.payment con custom fields del Studio (Story 9.7).
  const paymentValues: Record<string, unknown> = {
    partner_id: input.partnerId,
    journal_id: input.journalId,
    amount: input.amount,
    date: input.date,
    memo: input.memo,
    payment_type: input.paymentType ?? 'inbound',
    partner_type: 'customer',
    x_firebase_payment_id: input.firestoreId,
  }
  if (input.firebaseAgentUid) paymentValues.x_firebase_agent_uid = input.firebaseAgentUid
  if (typeof input.ocrConfidence === 'number') paymentValues.x_ocr_confidence = input.ocrConfidence

  const odooPaymentId = await client.create('account.payment', paymentValues)

  // 4) Write res_id real con retry inline.
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      await client.write('ir.model.data', [extIdRecordId], { res_id: odooPaymentId })
      lastError = null
      break
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay !== undefined) await sleep(delay)
    }
  }

  if (lastError) {
    await getFirestoreInstance()
      .collection(SYNCLOG_COLLECTION)
      .doc(input.firestoreId)
      .set(
        {
          orphan: true,
          odooPaymentId,
          extIdRecordId,
          lastError: lastError.message.slice(0, MAX_ERROR_LENGTH),
          markedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    return { odooPaymentId, extIdRecordId, isNew: true, orphan: true }
  }

  return { odooPaymentId, extIdRecordId, isNew: true, orphan: false }
}

// =====================================================================
// Resolución de partner / journal
// =====================================================================

export class PartnerNotFoundError extends AppError {
  constructor(clientName: string) {
    super('ODOO_PARTNER_NOT_FOUND', `partner_not_found: ${clientName}`, 404, false)
  }
}

export async function resolvePartnerId(client: OdooClient, clientName: string): Promise<number> {
  const trimmed = (clientName ?? '').trim()
  if (!trimmed) throw new PartnerNotFoundError('<empty>')
  // Odoo soporta '=ilike' (exact case-insensitive); el tipo OdooDomain del proyecto
  // solo enumera 'ilike'/'like' — cast localizado para usar el operador correcto.
  const domain = [
    ['name', '=ilike', trimmed],
    ['customer_rank', '>', 0],
  ] as unknown as OdooDomain
  const rows = await client.searchRead('res.partner', domain, ['id'], { limit: 1 })
  if (!rows.length) throw new PartnerNotFoundError(trimmed)
  return rows[0].id as number
}

export interface ResolveJournalResult {
  journalId: number
  journalName: string
  fallback: boolean
}

export async function resolveJournalId(
  client: OdooClient,
  paymentMethod: PaymentMethod | string | null | undefined,
): Promise<ResolveJournalResult> {
  const cashId = parseEnvInt(process.env.ODOO_JOURNAL_CASH_ID)
  const bankId = parseEnvInt(process.env.ODOO_JOURNAL_BANK_DEFAULT_ID)
  let targetId: number | null = null
  let fallback = false

  if (paymentMethod === 'cash' && cashId) {
    targetId = cashId
  } else if (bankId) {
    targetId = bankId
    if (paymentMethod === 'cash' && !cashId) fallback = true
  }

  if (!targetId) {
    throw new AppError(
      'ODOO_JOURNAL_NOT_CONFIGURED',
      'Faltan vars de entorno ODOO_JOURNAL_BANK_DEFAULT_ID / ODOO_JOURNAL_CASH_ID',
      500,
      false,
    )
  }

  const rows = await client.searchRead('account.journal', [['id', '=', targetId]], ['name'], { limit: 1 })
  const journalName = (rows[0]?.name as string | undefined) ?? `Journal ${targetId}`

  return { journalId: targetId, journalName, fallback }
}

function parseEnvInt(value: string | undefined): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

// =====================================================================
// Capa 2 — Orquestador (público, NUNCA throw)
// =====================================================================

export type SyncStatus = 'synced' | 'error' | 'orphan'

export interface SyncedPaymentDoc {
  amountCents?: number
  paymentMethod?: PaymentMethod | null
  date?: { toDate?: () => Date } | Date | string | null
  clientName?: string | null
  agentId?: string | null
  orderId?: string | null
  ocrResult?: { confidence?: number | null } | null
  /** Estado del sync — si 'dismissed' el push se skipea sin throw. */
  odooSyncStatus?: string | null
  /** URL del comprobante en Firebase Storage — usada por Story 9.4 attachment sync. */
  receiptUrl?: string | null
}

export interface SyncVerifiedPaymentResult {
  status: SyncStatus
  odooPaymentId?: number
  odooJournalId?: number
  odooJournalName?: string
  isNew: boolean
  orphan: boolean
  error?: string
  retryable?: boolean
}

/** Best-effort orquestador. Captura TODO y actualiza Firestore mirror. */
export async function syncVerifiedPaymentToOdoo(
  firestoreId: string,
  paymentData: SyncedPaymentDoc,
): Promise<SyncVerifiedPaymentResult> {
  // Guard: pagos dismissed no se pushean (Story 9.6 F1).
  if (paymentData.odooSyncStatus === 'dismissed') {
    return { status: 'error', isNew: false, orphan: false, error: 'dismissed', retryable: false }
  }

  const paymentRef = getFirestoreInstance().collection(PAYMENTS_COLLECTION).doc(firestoreId)

  try {
    const client = getOdooClient()

    // 1. Resolver partner. Si clientName falta (pagos legacy sin denormalizar),
    //    intentar enriquecer desde orders/{orderId}.contactName antes de fallar.
    let resolvedClientName = paymentData.clientName ?? ''
    if (!resolvedClientName.trim() && paymentData.orderId) {
      try {
        const orderSnap = await getFirestoreInstance()
          .collection('orders')
          .doc(paymentData.orderId)
          .get()
        if (orderSnap.exists) {
          const orderData = orderSnap.data() as { contactName?: string | null } | undefined
          resolvedClientName = (orderData?.contactName ?? '').toString()
        }
      } catch (enrichErr) {
        console.warn('[syncVerifiedPaymentToOdoo] orders enrichment failed:', enrichErr)
      }
    }
    const partnerId = await resolvePartnerId(client, resolvedClientName)

    // 2. Resolver journal
    const journal = await resolveJournalId(client, paymentData.paymentMethod ?? null)

    // 3. Push 3-call
    const result = await pushPaymentToOdoo({
      firestoreId,
      partnerId,
      journalId: journal.journalId,
      amount: centsToUnits(paymentData.amountCents ?? 0),
      date: toIsoDate(paymentData.date),
      memo: buildMemo(paymentData),
      firebaseAgentUid: paymentData.agentId ?? null,
      ocrConfidence: paymentData.ocrResult?.confidence ?? null,
    })

    // 4. Update Firestore mirror
    const status: SyncStatus = result.orphan ? 'orphan' : 'synced'
    const mirror: Record<string, unknown> = {
      odooPaymentId: result.odooPaymentId,
      odooSyncStatus: status,
      odooSyncedAt: FieldValue.serverTimestamp(),
      odooState: 'draft',
      odooJournalId: journal.journalId,
      odooJournalName: journal.journalName,
      syncRetryCount: 0,
      odooLastError: result.orphan
        ? 'ir.model.data write res_id falló los 4 intentos — recuperable vía reintento'
        : null,
      syncedToOdoo: !result.orphan,
      updatedAt: FieldValue.serverTimestamp(),
    }
    await paymentRef.set(mirror, { merge: true })

    // Story 9.4 — sync best-effort del comprobante a Odoo Documents.
    // Solo si el push fue exitoso non-orphan (sin odooPaymentId válido no se intenta).
    // NUNCA degrada el resultado del push: errores se loggean en paymentAlerts + mirror.
    if (!result.orphan && result.odooPaymentId > 0) {
      try {
        await syncReceiptToOdoo({
          firestoreId,
          odooPaymentId: result.odooPaymentId,
          receiptUrl: paymentData.receiptUrl ?? null,
        })
      } catch (receiptErr) {
        // Doble red de seguridad: syncReceiptToOdoo ya captura todo internamente.
        console.error('[syncVerifiedPaymentToOdoo] syncReceiptToOdoo escapó (no debería)', receiptErr)
      }
    }

    return {
      status,
      odooPaymentId: result.odooPaymentId,
      odooJournalId: journal.journalId,
      odooJournalName: journal.journalName,
      isNew: result.isNew,
      orphan: result.orphan,
      ...(result.orphan ? { retryable: true } : {}),
    }
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, MAX_ERROR_LENGTH)
    const retryable = err instanceof AppError ? err.retryable : true
    const errorCode = err instanceof AppError ? err.code : 'UNKNOWN'
    try {
      await paymentRef.set(
        {
          odooSyncStatus: 'error',
          odooLastError: message,
          odooLastErrorCode: errorCode,
          syncRetryCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    } catch (mirrorErr) {
      console.error('[syncVerifiedPaymentToOdoo] Failed to persist error mirror:', mirrorErr)
    }

    // Escribir alerta operativa en paymentAlerts/ para que la consola admin
    // muestre algo cuando el usuario clickea "ver consola". Idempotente por docId.
    try {
      const alertId = paymentAlertDocId(firestoreId, 'orphan_payment')
      await getFirestoreInstance()
        .collection(PAYMENT_ALERTS_COLLECTION)
        .doc(alertId)
        .set(
          {
            paymentId: firestoreId,
            type: 'orphan_payment',
            status: 'open',
            errorMessage: message,
            firestoreStatus: 'verified',
            detectedAt: FieldValue.serverTimestamp(),
            runId: `push_${errorCode}`,
          },
          { merge: true },
        )
    } catch (alertErr) {
      console.error('[syncVerifiedPaymentToOdoo] Failed to write paymentAlert:', alertErr)
    }

    return { status: 'error', isNew: false, orphan: false, error: message, retryable }
  }
}

// =====================================================================
// Helpers
// =====================================================================

function getFirestoreInstance(): Firestore {
  return adminDb as unknown as Firestore
}

function centsToUnits(cents: number): number {
  return Math.round(cents) / 100
}

// Formatear en zona MX para evitar off-by-one cuando el picker envía hora local
// y se almacena como UTC (ej: "2026-05-12T19:00" MX → UTC 01:00 next day).
const MX_DATE_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' })

function toIsoDate(value: SyncedPaymentDoc['date']): string {
  const fallback = MX_DATE_FMT.format(new Date())
  if (!value) return fallback
  if (value instanceof Date) return MX_DATE_FMT.format(value)
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? fallback : MX_DATE_FMT.format(d)
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return MX_DATE_FMT.format(value.toDate())
  }
  return fallback
}

function buildMemo(p: SyncedPaymentDoc): string {
  const client = (p.clientName ?? '').trim() || 'Cliente'
  const prefix = p.orderId ? `${p.orderId} — ` : ''
  return `${prefix}${client}`.slice(0, 500)
}
