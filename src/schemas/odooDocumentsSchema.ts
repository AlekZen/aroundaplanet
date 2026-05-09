import { z } from 'zod'

export const odooDocumentScopeSchema = z.enum([
  'public-product',
  'trip-backoffice',
  'quote',
  'payment',
  'contract',
  'coupon',
  'sales',
  'internal',
  'unmatched',
])

export const odooDocumentRelationStatusSchema = z.enum(['linked', 'suggested', 'unmatched'])

export const odooDocumentsQuerySchema = z.object({
  search: z.string().max(120).optional(),
  scope: odooDocumentScopeSchema.or(z.literal('all')).optional(),
  relationStatus: odooDocumentRelationStatusSchema.or(z.literal('all')).optional(),
})

export function normalizeOdooDocumentName(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

