/**
 * Story 9.4 — POST /api/payments/[paymentId]/retry-attachment
 *
 * Reintenta upload del comprobante a Odoo Documents para pagos ya synced (push OK)
 * cuyo `odooAttachmentSyncStatus` es 'error' o 'never'. Idempotente:
 *   - Lee `documents.document` ligados al `account.payment` y compara `name`.
 *   - Si ya existe el mismo fileName canónico, retorna 200 con `alreadyExists=true`
 *     SIN crear duplicado.
 *   - Si no, dispara `syncReceiptToOdoo` (que descarga + sube + persiste mirror).
 *
 * Rate limit: max 5 retries por pago / 24h (lectura de `attachmentRetryCount`).
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { syncReceiptToOdoo } from '@/lib/odoo/sync/receipt-attachment'
import { listPaymentReceipts } from '@/lib/odoo/payments-attachments'

const PAYMENTS_COLLECTION = 'payments'
const MAX_RETRIES_24H = 5

interface RouteContext {
  params: Promise<{ paymentId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requirePermission('payments:verify')
    const { paymentId } = await context.params

    // Body opcional: { force?: boolean } para permitir explícitamente retry sobre legacy_linked.
    let force = false
    try {
      const text = await request.text()
      if (text.trim().length > 0) {
        const parsed = JSON.parse(text) as { force?: unknown }
        force = parsed.force === true
      }
    } catch {
      force = false
    }

    const ref = adminDb.collection(PAYMENTS_COLLECTION).doc(paymentId)
    const snap = await ref.get()
    if (!snap.exists) {
      throw new AppError('PAYMENT_NOT_FOUND', 'Pago no encontrado', 404)
    }
    const data = snap.data()!

    const odooPaymentId =
      typeof data.odooPaymentId === 'number' && data.odooPaymentId > 0
        ? (data.odooPaymentId as number)
        : null
    if (odooPaymentId === null) {
      throw new AppError(
        'PAYMENT_NOT_PUSHED',
        'El pago no ha sido pusheado a Odoo. Reintenta el push antes del comprobante.',
        400,
        false,
      )
    }

    const syncStatus = data.odooSyncStatus
    if (syncStatus !== 'synced' && syncStatus !== 'legacy_linked') {
      throw new AppError(
        'PAYMENT_NOT_SYNCED',
        `El pago tiene odooSyncStatus="${syncStatus ?? 'null'}". Solo synced/legacy_linked admiten retry de comprobante.`,
        400,
        false,
      )
    }
    // Los pagos legacy ya tienen el PDF maestro {Cliente}.pdf en Odoo Documents (patrón
    // confirmado en sesión 35). Sin `force: true`, retornar 409 para evitar duplicado visual.
    if (syncStatus === 'legacy_linked' && !force) {
      throw new AppError(
        'LEGACY_LINKED_REQUIRES_FORCE',
        'Este pago es legacy_linked: ya tiene comprobante en Odoo (PDF maestro). Para subir uno adicional, envía body { "force": true }.',
        409,
        false,
      )
    }

    const retryCount =
      typeof data.attachmentRetryCount === 'number' ? (data.attachmentRetryCount as number) : 0
    if (retryCount >= MAX_RETRIES_24H) {
      throw new AppError(
        'RATE_LIMITED',
        `Máximo de ${MAX_RETRIES_24H} retries superado. Escalar a admin para revisión manual.`,
        429,
        false,
      )
    }

    const receiptUrl = typeof data.receiptUrl === 'string' ? (data.receiptUrl as string) : null
    if (!receiptUrl) {
      throw new AppError(
        'RECEIPT_URL_MISSING',
        'El pago no tiene receiptUrl en Firestore — no hay nada que subir.',
        400,
        false,
      )
    }

    // Idempotencia: si ya hay un documents.document con el fileName canónico, NO duplicar.
    // El fileName canónico es `comprobante-<firestoreId>.<ext>`.
    try {
      const existing = await listPaymentReceipts(odooPaymentId)
      const canonicalPrefix = `comprobante-${paymentId}.`
      const match = existing.find((d) => d.name?.startsWith(canonicalPrefix))
      if (match) {
        // Asegurar que el doc Firestore refleja este documentId.
        await ref.set(
          {
            odooDocumentId: match.id,
            ...(match.attachment_id !== null
              ? { odooAttachmentIds: [match.attachment_id] }
              : {}),
            odooAttachmentSyncStatus: 'synced',
            odooAttachmentLastError: null,
          },
          { merge: true },
        )
        return NextResponse.json({
          ok: true,
          alreadyExists: true,
          odooDocumentId: match.id,
          odooAttachmentId: match.attachment_id,
        })
      }
    } catch (listErr) {
      console.warn('[retry-attachment] listPaymentReceipts falló — siguiendo con upload', {
        paymentId,
        error: listErr instanceof Error ? listErr.message : String(listErr),
      })
    }

    // No existe — disparar upload completo (download + upload + mirror).
    const result = await syncReceiptToOdoo({
      firestoreId: paymentId,
      odooPaymentId,
      receiptUrl,
    })

    if (result.status === 'error') {
      return NextResponse.json(
        {
          ok: false,
          status: 'error',
          reason: result.reason ?? null,
          error: result.error ?? 'Error desconocido en upload de comprobante',
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      alreadyExists: false,
      status: result.status,
      odooDocumentId: result.odooDocumentId ?? null,
      odooAttachmentId: result.odooAttachmentId ?? null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
