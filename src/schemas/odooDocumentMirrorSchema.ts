/**
 * Story 8.1b — Schemas Zod para mirror Firestore de `documents.document` Odoo.
 *
 * Tres colecciones:
 *  - `/odooDocuments/{odooDocumentId}` — archivos no-folder (type != 'folder')
 *  - `/odooDocumentFolders/{odooFolderId}` — folders (type === 'folder')
 *  - `/odooDocumentFolderMappings/{folderId}` — mappings dup→canónico (post Story 9.5)
 *
 * Quirks Odoo 18 (runbook):
 *  - XML-RPC retorna `false` (no null/'') para strings vacíos → helpers `safeString`.
 *  - many2one viene como `[id, name] | false` → helpers `m2oId` / `m2oName`.
 *  - `documents.facet` NO existe — tags son planas `documents.tag`.
 *  - `shortcut_document_id` es read-only post-create.
 */

import { z } from 'zod'

// =====================================================================
// Helpers para datos Odoo crudos
// =====================================================================

/** Odoo XML-RPC retorna `false` para strings vacíos. */
export const odooStringOrNullSchema = z
  .union([z.string(), z.literal(false), z.null(), z.undefined()])
  .transform((v): string | null => (typeof v === 'string' ? v : null))

/** many2one viene como [id, name] o false. */
export const odooMany2OneSchema = z
  .union([
    z.tuple([z.number(), z.string()]),
    z.tuple([z.number(), z.literal(false)]),
    z.literal(false),
    z.null(),
    z.undefined(),
  ])
  .transform((v): { id: number; name: string | null } | null => {
    if (Array.isArray(v) && typeof v[0] === 'number') {
      return { id: v[0], name: typeof v[1] === 'string' ? v[1] : null }
    }
    return null
  })

export const odooNumberOrNullSchema = z
  .union([z.number(), z.literal(false), z.null(), z.undefined()])
  .transform((v): number | null => (typeof v === 'number' ? v : null))

export const odooBoolSchema = z
  .union([z.boolean(), z.null(), z.undefined()])
  .transform((v): boolean => Boolean(v))

// =====================================================================
// Raw row schemas (lo que viene de Odoo searchRead)
// =====================================================================

export const odooDocumentRawSchema = z.object({
  id: z.number().int().positive(),
  name: odooStringOrNullSchema,
  type: odooStringOrNullSchema,
  mimetype: odooStringOrNullSchema,
  file_size: odooNumberOrNullSchema.optional(),
  folder_id: odooMany2OneSchema.optional(),
  attachment_id: odooMany2OneSchema.optional(),
  res_model: odooStringOrNullSchema.optional(),
  res_id: odooNumberOrNullSchema.optional(),
  res_name: odooStringOrNullSchema.optional(),
  owner_id: odooMany2OneSchema.optional(),
  create_uid: odooMany2OneSchema.optional(),
  create_date: odooStringOrNullSchema.optional(),
  write_uid: odooMany2OneSchema.optional(),
  write_date: odooStringOrNullSchema.optional(),
  tag_ids: z.array(z.number()).optional().default([]),
  parent_folder_id: odooMany2OneSchema.optional(),
  shortcut_document_id: odooMany2OneSchema.optional(),
})

export type OdooDocumentRaw = z.infer<typeof odooDocumentRawSchema>

// =====================================================================
// Mirror Firestore — odooDocuments (no-folder)
// =====================================================================

export const odooDocumentScopeMirrorSchema = z.enum([
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

export const odooDocumentMirrorSchema = z.object({
  odooDocumentId: z.number().int().positive(),
  name: z.string(),
  type: z.string(), // 'binary' | 'url' | etc. (NUNCA 'folder' acá)
  mimetype: z.string().nullable(),
  fileSize: z.number().int().nonnegative(),
  folderId: z.number().int().positive().nullable(),
  folderName: z.string().nullable(),
  attachmentId: z.number().int().positive().nullable(),
  resModel: z.string().nullable(),
  resId: z.number().int().nonnegative().nullable(),
  resName: z.string().nullable(),
  ownerId: z.number().int().positive().nullable(),
  ownerName: z.string().nullable(),
  createUid: z.number().int().positive().nullable(),
  createDate: z.string().nullable(), // ISO Odoo "YYYY-MM-DD HH:MM:SS"
  writeUid: z.number().int().positive().nullable(),
  writeDate: z.string().nullable(),
  tagIds: z.array(z.number().int()).default([]),
  scope: odooDocumentScopeMirrorSchema,
  // Bookkeeping mirror
  syncedAt: z.unknown(), // Timestamp | FieldValue
  syncRunId: z.string().optional(),
})

export type OdooDocumentMirror = z.infer<typeof odooDocumentMirrorSchema>

// =====================================================================
// Mirror Firestore — odooDocumentFolders
// =====================================================================

export const odooDocumentFolderMirrorSchema = z.object({
  odooFolderId: z.number().int().positive(),
  name: z.string(),
  parentFolderId: z.number().int().positive().nullable(),
  parentFolderName: z.string().nullable(),
  /** read-only post-create en Odoo 18 — solo mirror. */
  shortcutDocumentId: z.number().int().positive().nullable(),
  ownerId: z.number().int().positive().nullable(),
  ownerName: z.string().nullable(),
  tagIds: z.array(z.number().int()).default([]),
  /** Inferido tras Story 9.5: si tiene tag `folder-canonico` (id 49). */
  isCanonical: z.boolean().default(false),
  /** Inferido tras Story 9.5: si tiene tag `folder-duplicado` (id 50). */
  isDuplicate: z.boolean().default(false),
  createDate: z.string().nullable(),
  writeDate: z.string().nullable(),
  syncedAt: z.unknown(),
  syncRunId: z.string().optional(),
})

export type OdooDocumentFolderMirror = z.infer<typeof odooDocumentFolderMirrorSchema>

// =====================================================================
// Mirror Firestore — odooDocumentFolderMappings
// =====================================================================

export const odooDocumentFolderMappingSchema = z.object({
  /** docId = `${duplicateFolderId}` */
  duplicateFolderId: z.number().int().positive(),
  canonicalFolderId: z.number().int().positive(),
  /** Confianza heurística 0-100. 100 = confirmed manual admin. */
  confidence: z.number().int().min(0).max(100),
  /** Cómo se detectó este mapping. */
  detectedBy: z.enum(['story-9-5-execute', 'admin-manual', 'name-match']),
  /** Status admin: 'auto' (heurística), 'confirmed' (admin lo aprobó), 'dismissed'. */
  status: z.enum(['auto', 'confirmed', 'dismissed']).default('auto'),
  confirmedBy: z.string().nullable().optional(),
  confirmedAt: z.unknown().nullable().optional(),
  createdAt: z.unknown(),
  updatedAt: z.unknown(),
})

export type OdooDocumentFolderMapping = z.infer<typeof odooDocumentFolderMappingSchema>

// =====================================================================
// Sync run summary (response del endpoint POST /sync)
// =====================================================================

export const documentsSyncRunSummarySchema = z.object({
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  errored: z.number().int().nonnegative(),
  cursor: z.string(),
  durationMs: z.number().int().nonnegative(),
  fetched: z.number().int().nonnegative(),
  runId: z.string(),
  dryRun: z.boolean().default(false),
})

export type DocumentsSyncRunSummary = z.infer<typeof documentsSyncRunSummarySchema>

export const documentsSyncRequestSchema = z.object({
  since: z.string().datetime().optional(),
  dryRun: z.boolean().optional().default(false),
  batchSize: z.number().int().min(50).max(500).optional().default(200),
  /** Si true, fuerza un re-sync completo (ignora cursor). */
  full: z.boolean().optional().default(false),
})

export type DocumentsSyncRequest = z.infer<typeof documentsSyncRequestSchema>
