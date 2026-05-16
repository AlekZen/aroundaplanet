/**
 * Story 8.1b — Pull `documents.document` Odoo → Firestore (mirror read-only).
 *
 * Lee folders + archivos vía `documents.document` paginado (NUNCA binarios), los
 * persiste en 3 colecciones Firestore con batched writes idempotentes:
 *  - `/odooDocuments/{odooDocumentId}` — type != 'folder'
 *  - `/odooDocumentFolders/{odooFolderId}` — type === 'folder'
 *  - `/odooDocumentFolderMappings/{duplicateFolderId}` — dup→canónico (post Story 9.5)
 *
 * Idempotencia: cursor incremental por write_date en `syncCursors/odooDocuments`.
 * Concurrencia: lock doc `syncCursors/odooDocuments` con `inProgress: true`.
 *
 * Restricciones firmes runbook Odoo 18:
 *  - NUNCA binarios (datas/raw/db_datas excluidos del fields list).
 *  - NUNCA escritura hacia Odoo (este es PULL puro).
 *  - Odoo retorna `false` para strings vacíos → toda lectura pasa por Zod safeParse.
 *  - `documents.facet` NO existe.
 */

import 'server-only'
import { FieldValue, type Firestore, type WriteBatch } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { getOdooClient, type OdooClient } from '@/lib/odoo/client'
import type { OdooDomain } from '@/types/odoo'
import {
  odooDocumentRawSchema,
  type OdooDocumentRaw,
  type OdooDocumentMirror,
  type OdooDocumentFolderMirror,
  type DocumentsSyncRunSummary,
} from '@/schemas/odooDocumentMirrorSchema'
import { normalizeOdooDocumentName } from '@/schemas/odooDocumentsSchema'

// =====================================================================
// Constantes
// =====================================================================

export const DOCUMENTS_PAGE_SIZE = 200
export const DOCUMENTS_BATCH_SIZE = 400 // Firestore límite duro 500/batch — margin 100
export const DOCUMENTS_HARD_TIMEOUT_MS = 8 * 60 * 1000
export const DOCUMENTS_CURSOR_DOC = 'odooDocuments'
export const DOCUMENTS_COLLECTION = 'odooDocuments'
export const DOCUMENT_FOLDERS_COLLECTION = 'odooDocumentFolders'
export const FOLDER_MAPPINGS_COLLECTION = 'odooDocumentFolderMappings'
export const SYNC_CURSORS_COLLECTION = 'syncCursors'

/** Tags planos creados en Story 9.5: marca canónico vs duplicado. */
export const TAG_FOLDER_CANONICO = 49
export const TAG_FOLDER_DUPLICADO = 50

/** Campos `documents.document` que el pull lee — NUNCA binarios (datas/raw/db_datas). */
export const DOCUMENT_FIELDS = [
  'id',
  'name',
  'type',
  'mimetype',
  'file_size',
  'folder_id',
  'attachment_id',
  'res_model',
  'res_id',
  'res_name',
  'owner_id',
  'create_uid',
  'create_date',
  'write_uid',
  'write_date',
  'tag_ids',
] as const

// =====================================================================
// Tipos públicos
// =====================================================================

export interface SyncOptions {
  /** Fuerza un re-sync completo (ignora cursor existente). */
  full?: boolean
  /** Override cursor manual (timestamp Odoo "YYYY-MM-DD HH:MM:SS"). */
  since?: string
  /** Solo computar shape — NO escribir Firestore. */
  dryRun?: boolean
  /** Page size de Odoo searchRead (default 200, max 500). */
  batchSize?: number
  /** Test inject. */
  now?: () => number
  runId?: string
  hardTimeoutMs?: number
}

export interface SyncCursorDoc {
  lastCursor?: string
  lastRunAt?: unknown
  lastRunSummary?: DocumentsSyncRunSummary
  lastError?: string | null
  inProgress?: boolean
  inProgressStartedAt?: unknown
  inProgressRunId?: string
}

// =====================================================================
// Errores tipados
// =====================================================================

export class DocumentsSyncLockError extends Error {
  constructor(public readonly currentRunId: string) {
    super(`documents sync already in progress (run ${currentRunId})`)
    this.name = 'DocumentsSyncLockError'
  }
}

// =====================================================================
// Inferencia de scope (reuso de classifyFolder del modelo existente)
// =====================================================================

export function inferScope(
  folderPath: string | null,
  docName: string,
): OdooDocumentMirror['scope'] {
  const haystack = normalizeOdooDocumentName(`${folderPath ?? ''} ${docName}`)
  if (haystack.includes('pago')) return 'payment'
  if (haystack.includes('venta')) return 'sales'
  if (haystack.includes('cotizacion')) return 'quote'
  if (haystack.includes('cupon')) return 'coupon'
  if (haystack.includes('contrato')) return 'contract'
  if (haystack.includes('itinerario') || haystack.includes('flyer')) return 'trip-backoffice'
  if (haystack.includes('project')) return 'internal'
  return 'unmatched'
}

// =====================================================================
// Mappers raw → mirror
// =====================================================================

export function mapRawToDocumentMirror(
  raw: OdooDocumentRaw,
  folderPathById: Map<number, string>,
  runId: string,
): OdooDocumentMirror {
  const folderId = raw.folder_id?.id ?? null
  const folderName = raw.folder_id?.name ?? null
  const folderPath = folderId != null ? folderPathById.get(folderId) ?? folderName : null

  return {
    odooDocumentId: raw.id,
    name: raw.name ?? 'Sin nombre',
    type: raw.type ?? 'binary',
    mimetype: raw.mimetype ?? null,
    fileSize: raw.file_size ?? 0,
    folderId,
    folderName,
    attachmentId: raw.attachment_id?.id ?? null,
    resModel: raw.res_model ?? null,
    resId: raw.res_id ?? null,
    resName: raw.res_name ?? null,
    ownerId: raw.owner_id?.id ?? null,
    ownerName: raw.owner_id?.name ?? null,
    createUid: raw.create_uid?.id ?? null,
    createDate: raw.create_date ?? null,
    writeUid: raw.write_uid?.id ?? null,
    writeDate: raw.write_date ?? null,
    tagIds: raw.tag_ids ?? [],
    scope: inferScope(folderPath, raw.name ?? ''),
    syncedAt: FieldValue.serverTimestamp(),
    syncRunId: runId,
  }
}

export function mapRawToFolderMirror(
  raw: OdooDocumentRaw,
  runId: string,
): OdooDocumentFolderMirror {
  const tagIds = raw.tag_ids ?? []
  return {
    odooFolderId: raw.id,
    name: raw.name ?? 'Sin nombre',
    parentFolderId: raw.folder_id?.id ?? raw.parent_folder_id?.id ?? null,
    parentFolderName: raw.folder_id?.name ?? raw.parent_folder_id?.name ?? null,
    shortcutDocumentId: raw.shortcut_document_id?.id ?? null,
    ownerId: raw.owner_id?.id ?? null,
    ownerName: raw.owner_id?.name ?? null,
    tagIds,
    isCanonical: tagIds.includes(TAG_FOLDER_CANONICO),
    isDuplicate: tagIds.includes(TAG_FOLDER_DUPLICADO),
    createDate: raw.create_date ?? null,
    writeDate: raw.write_date ?? null,
    syncedAt: FieldValue.serverTimestamp(),
    syncRunId: runId,
  }
}

// =====================================================================
// Construcción de folder path tree (BFS desde root)
// =====================================================================

export function buildFolderPathMap(folders: OdooDocumentRaw[]): Map<number, string> {
  const byId = new Map<number, OdooDocumentRaw>()
  for (const f of folders) byId.set(f.id, f)

  const cache = new Map<number, string>()

  function resolve(id: number, seen: Set<number>): string {
    if (cache.has(id)) return cache.get(id)!
    if (seen.has(id)) return '' // ciclo defensivo
    seen.add(id)
    const f = byId.get(id)
    if (!f) return ''
    const parentId = f.folder_id?.id ?? f.parent_folder_id?.id ?? null
    const parentPath = parentId != null ? resolve(parentId, seen) : ''
    const name = f.name ?? 'Sin nombre'
    const path = parentPath ? `${parentPath} / ${name}` : name
    cache.set(id, path)
    return path
  }

  for (const f of folders) resolve(f.id, new Set<number>())
  return cache
}

// =====================================================================
// Helper interno: paginar searchRead documents.document
// =====================================================================

async function fetchDocumentsPage(
  client: OdooClient,
  cursor: string,
  offset: number,
  limit: number,
  fetchAll: boolean,
): Promise<OdooDocumentRaw[]> {
  const domain: OdooDomain = fetchAll ? [] : [['write_date', '>', cursor]]
  const rows = await client.searchRead(
    'documents.document',
    domain,
    [...DOCUMENT_FIELDS],
    { offset, limit, order: 'write_date asc, id asc' },
  )

  const parsed: OdooDocumentRaw[] = []
  for (const raw of rows) {
    const result = odooDocumentRawSchema.safeParse(raw)
    if (result.success) parsed.push(result.data)
    // else: skip silently — el caller incrementa `errored` con error agregado.
    // No persistimos el raw para no leakear shape no validado.
  }
  return parsed
}

// =====================================================================
// Lock helpers (concurrencia)
// =====================================================================

export async function acquireLock(
  db: Firestore,
  runId: string,
  now: () => number,
): Promise<void> {
  const ref = db.collection(SYNC_CURSORS_COLLECTION).doc(DOCUMENTS_CURSOR_DOC)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const data = (snap.data() ?? {}) as SyncCursorDoc
    if (data.inProgress) {
      // Si el lock es viejo (>10min), considerarlo stale y robarlo.
      const startedAtMs =
        data.inProgressStartedAt && typeof (data.inProgressStartedAt as { toMillis?: () => number }).toMillis === 'function'
          ? (data.inProgressStartedAt as { toMillis: () => number }).toMillis()
          : 0
      if (now() - startedAtMs < 10 * 60 * 1000) {
        throw new DocumentsSyncLockError(data.inProgressRunId ?? 'unknown')
      }
    }
    tx.set(
      ref,
      {
        inProgress: true,
        inProgressStartedAt: FieldValue.serverTimestamp(),
        inProgressRunId: runId,
      },
      { merge: true },
    )
  })
}

export async function releaseLock(
  db: Firestore,
  summary: DocumentsSyncRunSummary,
  newCursor: string,
  error: string | null,
): Promise<void> {
  const ref = db.collection(SYNC_CURSORS_COLLECTION).doc(DOCUMENTS_CURSOR_DOC)
  await ref.set(
    {
      inProgress: false,
      inProgressStartedAt: null,
      inProgressRunId: null,
      lastCursor: newCursor,
      lastRunAt: FieldValue.serverTimestamp(),
      lastRunSummary: summary,
      lastError: error,
    },
    { merge: true },
  )
}

// =====================================================================
// Orchestrator principal
// =====================================================================

export async function syncOdooDocuments(
  opts: SyncOptions = {},
  client: OdooClient = getOdooClient(),
  db: Firestore = adminDb,
): Promise<DocumentsSyncRunSummary> {
  const now = opts.now ?? Date.now
  const runId = opts.runId ?? `docs-sync-${now()}`
  const startMs = now()
  const hardTimeout = opts.hardTimeoutMs ?? DOCUMENTS_HARD_TIMEOUT_MS
  const pageSize = opts.batchSize ?? DOCUMENTS_PAGE_SIZE
  const dryRun = opts.dryRun ?? false

  const summary: DocumentsSyncRunSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errored: 0,
    fetched: 0,
    cursor: '',
    durationMs: 0,
    runId,
    dryRun,
  }

  // Resolver cursor inicial
  const cursorRef = db.collection(SYNC_CURSORS_COLLECTION).doc(DOCUMENTS_CURSOR_DOC)
  const snap = await cursorRef.get()
  const cursorData = (snap.data() ?? {}) as SyncCursorDoc
  const fetchAll = Boolean(opts.full)
  const lastCursor =
    opts.since ??
    (fetchAll ? '1970-01-01 00:00:00' : cursorData.lastCursor ?? '1970-01-01 00:00:00')

  // Adquirir lock (no en dry-run para permitir paralelismo de inspección)
  if (!dryRun) await acquireLock(db, runId, now)

  let maxWriteDate = lastCursor
  let error: string | null = null

  try {
    // 1) Fetch paginado completo del delta — separamos folders y docs en memoria
    const allRows: OdooDocumentRaw[] = []
    let offset = 0
    for (let i = 0; i < 100; i++) {
      if (now() - startMs > hardTimeout) throw new Error('documents_sync_timeout')
      const rows = await fetchDocumentsPage(client, lastCursor, offset, pageSize, fetchAll)
      if (rows.length === 0) break
      allRows.push(...rows)
      summary.fetched += rows.length
      if (rows.length < pageSize) break
      offset += pageSize
    }

    // 2) Particionar folders vs docs
    const folderRows = allRows.filter((r) => r.type === 'folder')
    const docRows = allRows.filter((r) => r.type !== 'folder')

    // 3) Para path resolution, necesitamos TODOS los folders (no solo del delta).
    //    Fetch separado SOLO si hay docs en el delta que referencian folders no traídos.
    const referencedFolderIds = new Set<number>()
    for (const d of docRows) {
      if (d.folder_id?.id != null) referencedFolderIds.add(d.folder_id.id)
    }
    const haveFolderIds = new Set(folderRows.map((f) => f.id))
    const missingFolderIds = [...referencedFolderIds].filter((id) => !haveFolderIds.has(id))

    const extraFolders: OdooDocumentRaw[] = []
    if (missingFolderIds.length > 0 && !fetchAll) {
      const extraDomain: OdooDomain = [
        ['type', '=', 'folder'],
        ['id', 'in', missingFolderIds],
      ]
      const rawExtra = await client.searchRead(
        'documents.document',
        extraDomain,
        [...DOCUMENT_FIELDS],
        { limit: missingFolderIds.length },
      )
      for (const r of rawExtra) {
        const parsed = odooDocumentRawSchema.safeParse(r)
        if (parsed.success) extraFolders.push(parsed.data)
      }
    }

    const folderPathMap = buildFolderPathMap([...folderRows, ...extraFolders])

    // 4) Writes en batched de DOCUMENTS_BATCH_SIZE
    if (!dryRun) {
      let batch: WriteBatch = db.batch()
      let opsInBatch = 0
      const flush = async () => {
        if (opsInBatch > 0) {
          await batch.commit()
          batch = db.batch()
          opsInBatch = 0
        }
      }

      // Folders
      for (const f of folderRows) {
        try {
          const mirror = mapRawToFolderMirror(f, runId)
          const ref = db.collection(DOCUMENT_FOLDERS_COLLECTION).doc(String(f.id))
          batch.set(ref, mirror, { merge: true })
          opsInBatch += 1
          summary.updated += 1
          if (opsInBatch >= DOCUMENTS_BATCH_SIZE) await flush()
        } catch {
          summary.errored += 1
        }
        if (f.write_date && f.write_date > maxWriteDate) maxWriteDate = f.write_date
      }

      // Documents
      for (const d of docRows) {
        try {
          const mirror = mapRawToDocumentMirror(d, folderPathMap, runId)
          const ref = db.collection(DOCUMENTS_COLLECTION).doc(String(d.id))
          batch.set(ref, mirror, { merge: true })
          opsInBatch += 1
          summary.updated += 1
          if (opsInBatch >= DOCUMENTS_BATCH_SIZE) await flush()
        } catch {
          summary.errored += 1
        }
        if (d.write_date && d.write_date > maxWriteDate) maxWriteDate = d.write_date
      }

      await flush()
    } else {
      // dry-run: solo contar
      summary.updated = folderRows.length + docRows.length
      for (const r of [...folderRows, ...docRows]) {
        if (r.write_date && r.write_date > maxWriteDate) maxWriteDate = r.write_date
      }
    }

    summary.cursor = maxWriteDate
    summary.durationMs = now() - startMs

    if (!dryRun) await releaseLock(db, summary, maxWriteDate, null)
    return summary
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
    summary.durationMs = now() - startMs
    summary.cursor = lastCursor
    summary.errored += 1
    if (!dryRun) {
      try {
        await releaseLock(db, summary, lastCursor, error.slice(0, 2000))
      } catch {
        // best effort
      }
    }
    if (err instanceof DocumentsSyncLockError) throw err
    throw err
  }
}
