import { z } from 'zod'

/**
 * Log de la dedup de folders Odoo Documents (Story 9.5).
 *
 * Colección Firestore: `folderDedupLog/{normalizedKey}` — un doc por cluster.
 * `normalizedKey` = nombre del cluster normalizado (lowercase + sin diacríticos +
 * espacios colapsados + sin sufijos numéricos finales). Sirve como id natural y
 * garantiza idempotencia (re-run no crea logs duplicados).
 *
 * NOTA pivote Camino C (descubierto al ejecutar real en prod): Odoo 18 rechaza
 * `write shortcut_document_id` post-create con error "No puede cambiar el documento
 * objetivo de los atajos". La dedup queda solo via tags planos `folder-canonico` /
 * `folder-duplicado` aplicados a `tag_ids` Many2many. El link semántico dup→canon
 * se preserva en este log Firestore (`canonicalId` ↔ `duplicateIds`).
 *
 * Lo escribe el script `scripts/execute-9-5-folder-dedup.mjs`.
 * Lo lee la UI `/admin/odoo-folders/dedup` (Task 6).
 */

const dedupTimestamp = z.union([z.date(), z.string()])

export const folderDedupLogSchema = z
  .object({
    normalizedKey: z.string().min(1),
    canonicalId: z.number().int().positive(),
    canonicalName: z.string().min(1),
    canonicalChildrenCount: z.number().int().min(0),
    duplicateIds: z.array(z.number().int().positive()).min(1),
    duplicateNames: z.array(z.string()).min(1),
    duplicatesChildrenCount: z.number().int().min(0),
    totalChildrenInDuplicates: z.number().int().min(0),
    executedAt: dedupTimestamp,
    executedBy: z.literal('script-9-5-execute'),
    snapshotFile: z.string().min(1),
    skippedReason: z.enum(['canonical_not_found']).optional(),
  })
  .refine((d) => d.duplicateIds.length === d.duplicateNames.length, {
    message: 'duplicateIds y duplicateNames deben tener misma longitud',
  })
  .refine((d) => !d.duplicateIds.includes(d.canonicalId), {
    message: 'canonicalId no puede estar en duplicateIds',
  })

export type FolderDedupLog = z.infer<typeof folderDedupLogSchema>
