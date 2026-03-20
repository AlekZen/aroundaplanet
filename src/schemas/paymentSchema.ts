import { z } from 'zod'

/** All valid payment statuses */
export const PAYMENT_STATUSES = [
  'pending_verification',
  'verified',
  'rejected',
  'info_requested',
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/** Valid payment methods */
export const PAYMENT_METHODS = [
  'transfer',
  'card',
  'cash',
  'deposit',
  'agent_collected',
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Human-readable labels for payment statuses */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending_verification: 'Pendiente',
  verified: 'Verificado',
  rejected: 'Rechazado',
  info_requested: 'Info Solicitada',
}

/** Human-readable labels for payment methods */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transfer: 'Transferencia',
  card: 'Tarjeta',
  cash: 'Efectivo',
  deposit: 'Deposito',
  agent_collected: 'Cobro por Agente',
}

export const paymentStatusSchema = z.enum(PAYMENT_STATUSES)
export const paymentMethodSchema = z.enum(PAYMENT_METHODS)

/** Schema for POST /api/payments — create a payment report */
export const createPaymentSchema = z.object({
  orderId: z.string().min(1, 'orderId es requerido'),
  amountCents: z.number().int().positive('El monto debe ser mayor a 0'),
  paymentMethod: paymentMethodSchema,
  date: z.string().min(1, 'La fecha del pago es requerida'),
  notes: z.string().max(500).optional(),
})

export type CreatePaymentFormData = z.infer<typeof createPaymentSchema>

/** Schema for PATCH /api/payments/[paymentId]/verify — admin action */
export const verifyPaymentSchema = z.object({
  action: z.enum(['verify', 'reject', 'request_info']),
  rejectionNote: z.string().min(5, 'El motivo debe tener al menos 5 caracteres').optional(),
}).refine(
  (data) => data.action !== 'reject' || (data.rejectionNote && data.rejectionNote.length >= 5),
  { message: 'Motivo de rechazo es obligatorio', path: ['rejectionNote'] }
)

export type VerifyPaymentFormData = z.infer<typeof verifyPaymentSchema>

/** Schema for GET /api/payments query params */
export const paymentListQuerySchema = z.object({
  status: paymentStatusSchema.optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
})
