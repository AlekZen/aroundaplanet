import { z } from 'zod'

export const xDupStatusSchema = z.enum(['canonico', 'secundario']).nullable()

export const odooPaymentRowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().nullable(),
  memo: z.string().nullable(),
  amount: z.number(),
  date: z.string().nullable(),
  partnerId: z.number().int().nullable(),
  partnerName: z.string().nullable(),
  journalId: z.number().int().nullable(),
  journalName: z.string().nullable(),
  state: z.string(),
  xDupStatus: xDupStatusSchema,
  xCanonicalPaymentId: z.number().int().positive().nullable(),
  // Enrichment opcional (Story 9.1 UX) — null si no se pudo resolver
  tripName: z.string().nullable().optional(),
  agentName: z.string().nullable().optional(),
  saleOrderName: z.string().nullable().optional(),
  paymentMethodLine: z.string().nullable().optional(),
  communication: z.string().nullable().optional(),
  reconcileDate: z.string().nullable().optional(),
})

export const clusterStateSchema = z.enum(['unmarked', 'canonical_set', 'inconsistent'])

export const duplicateClusterSchema = z.object({
  clusterId: z.string(),
  currentState: clusterStateSchema,
  canonicalId: z.number().int().positive().nullable(),
  members: z.array(odooPaymentRowSchema).min(2),
  // Enrichment cluster-level (Story 9.1 UX)
  sameTrip: z.boolean().nullable().optional(), // null = al menos uno sin tripName
  sameAgent: z.boolean().nullable().optional(),
  maxDateDiffDays: z.number().int().min(0).optional(),
  // Flags Firestore
  dismissed: z.boolean().optional(),
  flagged: z.boolean().optional(),
  flagNote: z.string().nullable().optional(),
})

export const duplicatesGetResponseSchema = z.object({
  generatedAt: z.string(),
  summary: z.object({
    totalClusters: z.number().int().min(0),
    unmarked: z.number().int().min(0),
    canonicalSet: z.number().int().min(0),
    inconsistent: z.number().int().min(0),
  }),
  clusters: z.array(duplicateClusterSchema),
})

export const setCanonicalBodySchema = z
  .object({
    clusterId: z.string().min(1),
    canonicalOdooId: z.number().int().positive(),
    memberOdooIds: z.array(z.number().int().positive()).min(2),
  })
  .refine((d) => d.memberOdooIds.includes(d.canonicalOdooId), {
    message: 'canonicalOdooId debe estar en memberOdooIds',
    path: ['canonicalOdooId'],
  })

export const dedupLogActionSchema = z.enum(['set_canonical'])
export const dedupLogStatusSchema = z.enum(['success', 'partial', 'failed'])

// === Dismiss + Flag (Story 9.1 UX, Firestore-only writes) ===

export const dismissBodySchema = z.object({
  clusterId: z.string().min(1),
  memberOdooIds: z.array(z.number().int().positive()).min(2),
  reason: z.string().max(500).optional(),
})

export const flagBodySchema = z.object({
  clusterId: z.string().min(1),
  memberOdooIds: z.array(z.number().int().positive()).min(2),
  note: z.string().max(500).optional(),
})

export type DismissBody = z.infer<typeof dismissBodySchema>
export type FlagBody = z.infer<typeof flagBodySchema>

export type OdooPaymentRowDto = z.infer<typeof odooPaymentRowSchema>
export type DuplicateClusterDto = z.infer<typeof duplicateClusterSchema>
export type DuplicatesGetResponse = z.infer<typeof duplicatesGetResponseSchema>
export type SetCanonicalBody = z.infer<typeof setCanonicalBodySchema>
