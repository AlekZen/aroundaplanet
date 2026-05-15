import { z } from 'zod'

/**
 * Story 10.1 — Catálogo de plantillas de contrato por destino.
 *
 * El texto legal (20 cláusulas + declaraciones + firmas) vive en el componente
 * React-PDF `<ContractDocument />` (`src/lib/pdf/templates/ContractDocument.tsx`).
 * Este catálogo solo guarda los DATOS por destino que parametrizan el contrato:
 *   - Label visible y key estable
 *   - Plazo de pago en días (varía 30 vs 60 según destino)
 *   - Anexo 1: lo que INCLUYE / VISITAMOS / NO INCLUYE
 *
 * Paloma puede agregar destinos nuevos sin tocar código creando docs Firestore
 * desde un script seed o UI futura (Fase 1).
 */
export const contractTemplateSchema = z.object({
  templateId: z.string().min(1),
  templateKey: z
    .string()
    .min(1, 'templateKey requerido')
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'templateKey debe ser kebab-case (a-z, 0-9, guiones)'),
  destinoLabel: z.string().min(1).max(120),
  scope: z.enum(['internacional', 'nacional']),
  plazoLimitePagoDias: z.number().int().min(1).max(365),
  anexoIncluye: z.array(z.string().min(1).max(300)).min(1, 'Anexo INCLUYE requiere al menos 1 ítem'),
  anexoVisitamos: z.array(z.string().min(1).max(200)).optional().default([]),
  anexoNoIncluye: z.array(z.string().min(1).max(200)).optional().default([]),
  active: z.boolean().default(true),
  notes: z.string().max(1000).nullable().optional(),
})

export type ContractTemplate = z.infer<typeof contractTemplateSchema>
