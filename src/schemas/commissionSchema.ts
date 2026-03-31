import { z } from 'zod'

/** All valid commission statuses */
export const COMMISSION_STATUSES = ['pending', 'approved', 'paid'] as const

export type CommissionStatus = (typeof COMMISSION_STATUSES)[number]

/** Human-readable labels for commission statuses */
export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  paid: 'Pagada',
}

export const commissionStatusSchema = z.enum(COMMISSION_STATUSES)

/** Schema for PATCH /api/commissions/[commissionId] — admin changes status */
export const updateCommissionStatusSchema = z.object({
  status: z.enum(['approved', 'paid']),
  commissionAmountCents: z.number().int().positive().optional(),
})

export type UpdateCommissionStatusData = z.infer<typeof updateCommissionStatusSchema>

/** Schema for GET /api/commissions query params */
export const commissionListQuerySchema = z.object({
  status: commissionStatusSchema.optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Formato de periodo debe ser YYYY-MM').optional(),
  agentId: z.string().optional(),
})
