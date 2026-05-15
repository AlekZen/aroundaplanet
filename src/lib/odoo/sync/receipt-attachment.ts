/**
 * Story 9.4 — Sync best-effort de comprobante (receipt) a Odoo Documents.
 *
 * Flujo (se invoca DESPUÉS de un push exitoso non-orphan del payment):
 *   1. Lee tagId desde `appConfig/odoo` (cache 10min).
 *   2. Descarga el binario desde Firebase Storage (helper `downloadReceiptFromUrl`).
 *   3. Sube como `documents.document` a Odoo con res_model/res_id/tag_ids (Camino B1).
 *   4. Persiste mirror en `payments/{firestoreId}` (odooDocumentId, odooAttachmentIds, status).
 *   5. Si falla: escribe alerta `paymentAlerts/{firestoreId}__attachment_failed`. NO degrada el push.
 *
 * Invariante: esta función NUNCA throw. Captura todo y devuelve un resultado tipado.
 */

import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import {
  uploadPaymentReceipt,
  type UploadReceiptResult,
} from '@/lib/odoo/payments-attachments'
import { downloadReceiptFromUrl } from '@/lib/storage/download-receipt'
import {
  paymentAlertDocId,
  type AttachmentFailedReason,
} from '@/schemas/paymentAlertSchema'
import { AppError } from '@/lib/errors/AppError'
import { resolveCanonicalFolderId } from '@/lib/odoo/folder-canonical'

const PAYMENTS_COLLECTION = 'payments'
const ALERTS_COLLECTION = 'paymentAlerts'
const APP_CONFIG_COLLECTION = 'appConfig'
const APP_CONFIG_ODOO_DOC = 'odoo'
const TAG_CACHE_TTL_MS = 10 * 60 * 1000
/** TTL corto cuando la lectura retornó null/error — evita cachear "no configurado" durante 10min. */
const TAG_CACHE_NULL_TTL_MS = 30 * 1000
const MAX_ERROR_LENGTH = 2000

// =====================================================================
// Cache del tagId con TTL 10min
// =====================================================================

interface TagCacheEntry {
  tagId: number | null
  expiresAt: number
}

let tagCache: TagCacheEntry | null = null

/** @internal Reset para tests. */
export function resetReceiptTagCache(): void {
  tagCache = null
}

/**
 * Lee `appConfig/odoo.attachmentReceiptTagId` con cache 10min.
 * Si la lectura falla o el campo no está poblado, retorna `null`.
 * No throw — fallo silencioso, el caller decide si bloquear.
 */
export async function getReceiptTagId(): Promise<number | null> {
  const now = Date.now()
  if (tagCache && tagCache.expiresAt > now) {
    return tagCache.tagId
  }

  try {
    const snap = await adminDb
      .collection(APP_CONFIG_COLLECTION)
      .doc(APP_CONFIG_ODOO_DOC)
      .get()
    const data = snap.exists ? snap.data() : null
    const raw = data?.attachmentReceiptTagId
    const tagId =
      typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : null
    const ttl = tagId !== null ? TAG_CACHE_TTL_MS : TAG_CACHE_NULL_TTL_MS
    tagCache = { tagId, expiresAt: now + ttl }
    return tagId
  } catch (err) {
    console.warn('[getReceiptTagId] read appConfig/odoo falló — usando null', {
      error: err instanceof Error ? err.message : String(err),
    })
    tagCache = { tagId: null, expiresAt: now + TAG_CACHE_NULL_TTL_MS }
    return null
  }
}

// =====================================================================
// Resultado
// =====================================================================

export type ReceiptSyncStatus =
  | 'synced'
  | 'skipped_no_receipt'
  | 'error'

export interface SyncReceiptInput {
  firestoreId: string
  odooPaymentId: number
  receiptUrl?: string | null
  /** Story 9.5: usados por `resolveCanonicalFolderId` para asignar folder canónico. */
  tripDestino?: string | null
  paymentDate?: Date | null
}

export interface SyncReceiptResult {
  status: ReceiptSyncStatus
  odooDocumentId?: number
  odooAttachmentId?: number | null
  reason?: AttachmentFailedReason
  error?: string
  retryable?: boolean
}

// =====================================================================
// Orquestador (best-effort, NO throw)
// =====================================================================

export async function syncReceiptToOdoo(
  input: SyncReceiptInput,
): Promise<SyncReceiptResult> {
  const { firestoreId, odooPaymentId, receiptUrl } = input
  const paymentRef = adminDb.collection(PAYMENTS_COLLECTION).doc(firestoreId)

  // 1. Skip si no hay receiptUrl (pago legacy / sin comprobante).
  if (!receiptUrl || typeof receiptUrl !== 'string' || receiptUrl.length === 0) {
    try {
      await paymentRef.set(
        {
          odooAttachmentSyncStatus: 'skipped_no_receipt',
          odooAttachmentSyncedAt: FieldValue.serverTimestamp(),
          odooAttachmentLastError: null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    } catch (mirrorErr) {
      console.error('[syncReceiptToOdoo] mirror skip falló', mirrorErr)
    }
    return { status: 'skipped_no_receipt' }
  }

  // 2. Resolver tagId (puede ser null — el upload sigue degraded sin tag).
  const tagId = await getReceiptTagId()

  // 2b. Story 9.5: resolver folder canónico (best-effort, default disabled por feature flag).
  let folderId: number | null = null
  if (
    typeof input.tripDestino === 'string' &&
    input.tripDestino.length > 0 &&
    input.paymentDate instanceof Date &&
    !Number.isNaN(input.paymentDate.getTime())
  ) {
    const folderResult = await resolveCanonicalFolderId({
      tripDestino: input.tripDestino,
      paymentDate: input.paymentDate,
    })
    folderId = folderResult.folderId
    if (folderResult.source === 'error') {
      console.warn('[syncReceiptToOdoo] resolveCanonicalFolderId error (degraded)', {
        firestoreId,
        error: folderResult.error,
      })
    }
  }

  // 3. Pipeline download → upload con manejo de error tipificado.
  try {
    const { buffer, mimetype, fileName } = await downloadReceiptFromUrl(
      receiptUrl,
      firestoreId,
    )

    const uploadResult: UploadReceiptResult = await uploadPaymentReceipt({
      odooPaymentId,
      receiptBuffer: buffer,
      fileName,
      mimetype,
      tagId,
      folderId,
    })

    // 4. Persistir mirror éxito.
    try {
      const docId = uploadResult.odooDocumentId
      const attId = uploadResult.odooAttachmentId
      const mirror: Record<string, unknown> = {
        odooDocumentId: docId,
        odooAttachmentSyncStatus: 'synced',
        odooAttachmentSyncedAt: FieldValue.serverTimestamp(),
        odooAttachmentLastError: null,
        attachmentRetryCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
      }
      if (attId !== null) {
        mirror.odooAttachmentIds = FieldValue.arrayUnion(attId)
      }
      await paymentRef.set(mirror, { merge: true })
    } catch (mirrorErr) {
      console.error('[syncReceiptToOdoo] mirror éxito falló', mirrorErr)
    }

    // 5. Resolver alerta previa (si existía un attachment_failed por reintento manual).
    try {
      const alertRef = adminDb
        .collection(ALERTS_COLLECTION)
        .doc(paymentAlertDocId(firestoreId, 'attachment_failed'))
      const alertSnap = await alertRef.get()
      if (alertSnap.exists && alertSnap.data()?.status === 'open') {
        await alertRef.set(
          {
            status: 'resolved',
            resolvedAt: FieldValue.serverTimestamp(),
            resolvedBy: 'system_auto_retry',
            resolutionNote: `Reintento automático exitoso: documento ${uploadResult.odooDocumentId}`,
          },
          { merge: true },
        )
      }
    } catch (alertErr) {
      console.warn('[syncReceiptToOdoo] auto-resolve alerta previa falló', alertErr)
    }

    return {
      status: 'synced',
      odooDocumentId: uploadResult.odooDocumentId,
      odooAttachmentId: uploadResult.odooAttachmentId,
    }
  } catch (err) {
    const reason = mapErrorToReason(err)
    const message = (err instanceof Error ? err.message : String(err)).slice(
      0,
      MAX_ERROR_LENGTH,
    )
    const retryable = err instanceof AppError ? err.retryable : true

    // 6. Persistir mirror error.
    try {
      await paymentRef.set(
        {
          odooAttachmentSyncStatus: 'error',
          odooAttachmentLastError: message,
          attachmentRetryCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    } catch (mirrorErr) {
      console.error('[syncReceiptToOdoo] mirror error falló', mirrorErr)
    }

    // 7. Escribir alerta `attachment_failed` (idempotente por docId convencional).
    try {
      const alertRef = adminDb
        .collection(ALERTS_COLLECTION)
        .doc(paymentAlertDocId(firestoreId, 'attachment_failed'))
      await alertRef.set(
        {
          paymentId: firestoreId,
          type: 'attachment_failed',
          status: 'open',
          odooPaymentId,
          reason,
          errorMessage: message,
          detectedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    } catch (alertErr) {
      console.error('[syncReceiptToOdoo] write alerta falló', alertErr)
    }

    return { status: 'error', reason, error: message, retryable }
  }
}

// =====================================================================
// Helpers
// =====================================================================

function mapErrorToReason(err: unknown): AttachmentFailedReason {
  if (err instanceof AppError) {
    if (err.code === 'RECEIPT_NOT_FOUND') return 'receipt_missing'
    if (err.code === 'RECEIPT_INVALID_URL') return 'receipt_missing'
    if (err.code === 'RECEIPT_DOWNLOAD_FAILED') return 'upload_failed'
    if (err.code === 'ODOO_ATTACHMENT_INVALID_INPUT') return 'invalid_mimetype'
    if (err.code === 'ODOO_ATTACHMENT_CREATE_FAILED') return 'upload_failed'
  }
  return 'upload_failed'
}
