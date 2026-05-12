import { z } from 'zod'

export const xDupStatusSchema = z.enum(['canonico', 'secundario']).nullable()

export const odooPaymentRowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().nullable(),
  ref: z.string().nullable(),
  amount: z.number(),
  date: z.string().nullable(),
  partnerId: z.number().int().nullable(),
  partnerName: z.string().nullable(),
  journalId: z.number().int().nullable(),
  journalName: z.string().nullable(),
  state: z.string(),
  xDupStatus: xDupStatusSchema,
  xCanonicalPaymentId: z.number().int().positive().nullable(),
})

export const clusterStateSchema = z.enum(['unmarked', 'canonical_set', 'inconsistent'])

export const duplicateClusterSchema = z.object({
  clusterId: z.string(),
  currentState: clusterStateSchema,
  canonicalId: z.number().int().positive().nullable(),
  members: z.array(odooPaymentRowSchema).min(2),
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

export type OdooPaymentRowDto = z.infer<typeof odooPaymentRowSchema>
export type DuplicateClusterDto = z.infer<typeof duplicateClusterSchema>
export type DuplicatesGetResponse = z.infer<typeof duplicatesGetResponseSchema>
export type SetCanonicalBody = z.infer<typeof setCanonicalBodySchema>
