import { z } from 'zod'

// === Razones tipificadas de fallo de attachment (Story 9.4) ===
export const ATTACHMENT_FAILED_REASONS = [
  'upload_failed',
  'receipt_missing',
  'tag_unavailable',
  'invalid_mimetype',
] as const
export type AttachmentFailedReason = (typeof ATTACHMENT_FAILED_REASONS)[number]
export const attachmentFailedReasonSchema = z.enum(ATTACHMENT_FAILED_REASONS)

/**
 * Alertas operativas sobre pagos detectadas por los sync jobs (Stories 9.2, 9.3, 9.4).
 * Cada alerta es un doc en `paymentAlerts/{alertId}` con docId convencional
 * `${paymentId}_${type}` para garantizar idempotencia (un solo doc abierto por
 * combinación pago+tipo). Story 9.6 (UI admin) lista y resuelve.
 */

const alertTimestamp = z.union([z.date(), z.string()])

export const PAYMENT_ALERT_TYPES = [
  'odoo_canceled',
  'attachment_failed',
  'orphan_payment',
  'unknown_method',
] as const

export type PaymentAlertType = (typeof PAYMENT_ALERT_TYPES)[number]
export const paymentAlertTypeSchema = z.enum(PAYMENT_ALERT_TYPES)

export const PAYMENT_ALERT_STATUSES = ['open', 'dismissed', 'resolved'] as const
export type PaymentAlertStatus = (typeof PAYMENT_ALERT_STATUSES)[number]
export const paymentAlertStatusSchema = z.enum(PAYMENT_ALERT_STATUSES)

export const paymentAlertSchema = z.object({
  paymentId: z.string().min(1),
  type: paymentAlertTypeSchema,
  status: paymentAlertStatusSchema.default('open'),
  odooPaymentId: z.number().int().positive().nullable().optional(),
  odooState: z.string().max(64).nullable().optional(),
  firestoreStatus: z.string().max(64).nullable().optional(),
  detectedAt: alertTimestamp,
  runId: z.string().max(128).nullable().optional(),
  resolvedAt: alertTimestamp.nullable().optional(),
  resolvedBy: z.string().max(128).nullable().optional(),
  resolutionNote: z.string().max(500).nullable().optional(),
  // Campos de contexto adicional para attachment_failed (Story 9.4)
  reason: attachmentFailedReasonSchema.nullable().optional(),
  errorMessage: z.string().max(2000).nullable().optional(),
})

export type PaymentAlert = z.infer<typeof paymentAlertSchema>

/** Schema para writes desde el pull (omite resolvedAt/resolvedBy). */
export const createPaymentAlertSchema = paymentAlertSchema.pick({
  paymentId: true,
  type: true,
  odooPaymentId: true,
  odooState: true,
  firestoreStatus: true,
  detectedAt: true,
  runId: true,
  reason: true,
  errorMessage: true,
})

export type CreatePaymentAlert = z.infer<typeof createPaymentAlertSchema>

/** Helper: docId convencional para idempotencia. */
export function paymentAlertDocId(paymentId: string, type: PaymentAlertType): string {
  return `${paymentId}__${type}`
}
