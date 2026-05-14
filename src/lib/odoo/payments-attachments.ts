import { z } from 'zod'
import { getOdooClient } from '@/lib/odoo/client'
import { AppError } from '@/lib/errors/AppError'

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const
/** Odoo Online acepta hasta ~25MB. Cap defensivo a 15MB para margen XML-RPC + base64 overhead. */
const MAX_RECEIPT_BYTES = 15 * 1024 * 1024

/**
 * Resultado del upload de un comprobante a Odoo.
 *
 * Camino B1 (validado en sub-spike 9.4 chatter-visibility):
 *  - Crea un `documents.document` con res_model='account.payment' + res_id=paymentId + tag_ids.
 *  - Odoo crea automáticamente un `ir.attachment` debajo con el mismo res_model/res_id, por lo
 *    que el comprobante queda visible TANTO en el chatter del pago COMO en la Documents app
 *    filtrada por tag `aroundaplanet_comprobante`.
 *
 * `odooDocumentId` es el id primario que retorna el create (always present).
 * `odooAttachmentId` se lee best-effort después del create (1 call extra) y puede ser null si
 * la lectura falló. NO bloquea el flujo si falta.
 */
export const UploadReceiptResultSchema = z.object({
  odooDocumentId: z.number().int().positive(),
  odooAttachmentId: z.number().int().positive().nullable(),
  resModel: z.literal('account.payment'),
  resId: z.number().int().positive(),
  fileName: z.string().min(1),
  mimetype: z.string().min(1),
  uploadedAt: z.string().datetime(),
  tagId: z.number().int().positive().nullable(),
})
export type UploadReceiptResult = z.infer<typeof UploadReceiptResultSchema>

export interface UploadPaymentReceiptInput {
  odooPaymentId: number
  receiptBuffer: Buffer
  fileName: string
  mimetype: string
  tagId?: number | null
}

/** @internal Exportado solo para tests con fake timers. */
export function sleep(ms: number): Promise<void> {
  return new Promise<void>((r) => setTimeout(r, ms))
}

/**
 * Sube un comprobante a Odoo como `documents.document` ligado al `account.payment` indicado.
 *
 * REGLA OPERACIONAL (spike 9.0a EDGE): el caller GARANTIZA que `odooPaymentId` existe en Odoo
 * y no está en state='canceled'. Si llamas con un payment inexistente, el documents.document
 * + ir.attachment subyacente quedan ACL-locked de forma irreversible (record-rule sobre el
 * padre inexistente). NUNCA invertir el orden: primero push del payment, después comprobante.
 *
 * Camino B1 (sub-spike 9.4 chatter-visibility): 1 call al `documents.document.create`. El
 * ir.attachment subyacente hereda res_model/res_id automáticamente. Una segunda call lee el
 * id del ir.attachment subyacente (best-effort para auditoría / retry idempotente).
 */
export async function uploadPaymentReceipt(
  input: UploadPaymentReceiptInput,
): Promise<UploadReceiptResult> {
  if (!Number.isInteger(input.odooPaymentId) || input.odooPaymentId <= 0) {
    throw new AppError(
      'ODOO_ATTACHMENT_INVALID_INPUT',
      `odooPaymentId inválido: ${input.odooPaymentId}`,
      400,
      false,
    )
  }
  if (!input.fileName || !input.mimetype) {
    throw new AppError(
      'ODOO_ATTACHMENT_INVALID_INPUT',
      'fileName y mimetype requeridos',
      400,
      false,
    )
  }
  if (!input.receiptBuffer || input.receiptBuffer.length === 0) {
    throw new AppError(
      'ODOO_ATTACHMENT_INVALID_INPUT',
      'receiptBuffer vacío',
      400,
      false,
    )
  }
  if (input.receiptBuffer.length > MAX_RECEIPT_BYTES) {
    throw new AppError(
      'ODOO_ATTACHMENT_INVALID_INPUT',
      `receiptBuffer excede ${MAX_RECEIPT_BYTES} bytes (${input.receiptBuffer.length})`,
      413,
      false,
    )
  }

  const client = getOdooClient()
  const base64 = input.receiptBuffer.toString('base64')
  const tagIdResolved = input.tagId ?? null

  const createVals: Record<string, unknown> = {
    name: input.fileName,
    datas: base64,
    mimetype: input.mimetype,
    res_model: 'account.payment',
    res_id: input.odooPaymentId,
  }
  if (tagIdResolved !== null) {
    // Sintaxis x2many Odoo: [6, 0, ids] reemplaza la lista completa.
    createVals.tag_ids = [[6, 0, [tagIdResolved]]]
  }

  let lastError: Error | null = null
  let documentId: number | null = null

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const createdId = await client.create('documents.document', createVals)
      if (!Number.isInteger(createdId) || (createdId as number) <= 0) {
        throw new Error(`Odoo retornó documentId inválido: ${String(createdId)}`)
      }
      documentId = createdId as number
      break
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.error('[uploadPaymentReceipt]', {
        odooPaymentId: input.odooPaymentId,
        attempt,
        error: lastError.message,
      })
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay !== undefined) await sleep(delay)
    }
  }

  if (documentId === null) {
    throw new AppError(
      'ODOO_ATTACHMENT_CREATE_FAILED',
      `Upload del comprobante falló tras ${RETRY_DELAYS_MS.length + 1} intentos: ${lastError?.message ?? 'unknown'}`,
      502,
      true,
    )
  }

  // Best-effort: leer el ir.attachment subyacente para auditoría y retry idempotente.
  // NO bloqueante: si falla, retornamos odooAttachmentId=null.
  let attachmentId: number | null = null
  try {
    const rows = await client.read('documents.document', [documentId], ['attachment_id'])
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
    const att = row?.attachment_id
    // Odoo m2o retorna `[id, name]` o `false` si no hay relación.
    if (Array.isArray(att) && Number.isInteger(att[0]) && (att[0] as number) > 0) {
      attachmentId = att[0] as number
    }
  } catch (err) {
    console.warn('[uploadPaymentReceipt] read attachment_id falló (no-bloqueante)', {
      documentId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  const result: UploadReceiptResult = {
    odooDocumentId: documentId,
    odooAttachmentId: attachmentId,
    resModel: 'account.payment',
    resId: input.odooPaymentId,
    fileName: input.fileName,
    mimetype: input.mimetype,
    uploadedAt: new Date().toISOString(),
    tagId: tagIdResolved,
  }
  return UploadReceiptResultSchema.parse(result)
}

/**
 * Lista los `documents.document` ligados a un `account.payment`.
 * Útil para retry idempotente (endpoint retry-attachment de Story 9.6) y auditoría.
 *
 * Retorna también el `attachment_id` subyacente (m2o → primer elemento es el id del ir.attachment)
 * para facilitar dedup por `(name, file_size)`.
 */
export async function listPaymentReceipts(odooPaymentId: number): Promise<
  Array<{
    id: number
    name: string
    mimetype: string
    file_size: number
    create_date: string
    attachment_id: number | null
  }>
> {
  if (!Number.isInteger(odooPaymentId) || odooPaymentId <= 0) {
    throw new AppError(
      'ODOO_ATTACHMENT_INVALID_INPUT',
      `odooPaymentId inválido: ${odooPaymentId}`,
      400,
      false,
    )
  }

  const client = getOdooClient()
  const rows = await client.searchRead(
    'documents.document',
    [
      ['res_model', '=', 'account.payment'],
      ['res_id', '=', odooPaymentId],
    ],
    ['id', 'name', 'mimetype', 'file_size', 'create_date', 'attachment_id'],
    { limit: 50 },
  )

  return (rows as Array<Record<string, unknown>>).map((r) => {
    const att = r.attachment_id
    const attId =
      Array.isArray(att) && Number.isInteger(att[0]) && (att[0] as number) > 0
        ? (att[0] as number)
        : null
    return {
      id: r.id as number,
      name: (r.name as string) ?? '',
      mimetype: (r.mimetype as string) ?? '',
      file_size: typeof r.file_size === 'number' ? r.file_size : 0,
      create_date: (r.create_date as string) ?? '',
      attachment_id: attId,
    }
  })
}
