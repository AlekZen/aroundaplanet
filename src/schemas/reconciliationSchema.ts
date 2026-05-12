import { z } from 'zod'

const matchConfidenceSchema = z.enum(['high', 'medium', 'low'])

export const firestorePaymentSummarySchema = z.object({
  firestoreId: z.string(),
  partnerName: z.string().nullable(),
  clientName: z.string().nullable(),
  agentName: z.string().nullable(),
  amount: z.number(), // en pesos
  amountCents: z.number().int(),
  paymentDate: z.string().nullable(),
  paymentMethod: z.string().nullable(),
  orderId: z.string().nullable(),
  warnings: z.array(z.string()),
})

export const odooPaymentSummarySchema = z.object({
  odooId: z.number().int().positive(),
  partnerId: z.number().int().nullable(),
  partnerName: z.string().nullable(),
  amount: z.number(),
  date: z.string().nullable(),
  journalId: z.number().int().nullable(),
  journalName: z.string().nullable(),
  state: z.string(),
  ref: z.string().nullable(),
})

export const reconciliationCandidateSchema = z.object({
  firestoreId: z.string(),
  firestorePayment: firestorePaymentSummarySchema,
  odooId: z.number().int().positive(),
  odooPayment: odooPaymentSummarySchema,
  diff: z.object({
    amountDiff: z.number(),
    dateDiff: z.number(),
    partnerJaccard: z.number(),
  }),
  confidence: matchConfidenceSchema,
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
})

export const reconciliationGetResponseSchema = z.object({
  generatedAt: z.string(),
  summary: z.object({
    high: z.number().int().min(0),
    medium: z.number().int().min(0),
    low: z.number().int().min(0),
    none: z.number().int().min(0),
    matched: z.number().int().min(0),
  }),
  buckets: z.object({
    high: z.array(reconciliationCandidateSchema),
    medium: z.array(reconciliationCandidateSchema),
    low: z.array(reconciliationCandidateSchema),
    none: z.array(firestorePaymentSummarySchema),
  }),
})

export const reconciliationConfirmBodySchema = z.object({
  odooPaymentId: z.number().int().positive(),
  confidence: matchConfidenceSchema,
  notes: z.string().max(500).optional(),
})

export const reconciliationRejectBodySchema = z.object({
  odooPaymentId: z.number().int().positive(),
  reason: z.string().min(3, 'Razón requerida (≥3 chars)').max(500),
})

export const reconciliationLogActionSchema = z.enum(['linked', 'rejected'])

export type ReconciliationCandidate = z.infer<typeof reconciliationCandidateSchema>
export type FirestorePaymentSummary = z.infer<typeof firestorePaymentSummarySchema>
export type OdooPaymentSummary = z.infer<typeof odooPaymentSummarySchema>
export type ReconciliationGetResponse = z.infer<typeof reconciliationGetResponseSchema>
export type ReconciliationConfirmBody = z.infer<typeof reconciliationConfirmBodySchema>
export type ReconciliationRejectBody = z.infer<typeof reconciliationRejectBodySchema>
