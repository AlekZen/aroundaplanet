/**
 * Story 9.5 — Resolver folder canónico de `documents.document` por destino+mes+año.
 *
 * Se invoca opcionalmente desde `syncReceiptToOdoo` ANTES de subir el comprobante,
 * para que el nuevo `documents.document` quede en el folder canónico del cluster.
 *
 * Feature flags (en `appConfig/odoo`):
 *  - `folderAutoAssign` (default false): si false, retorna `{folderId: null, source: 'disabled'}`.
 *  - `folderAutoCreate` (default false): si true y no hay canónico, crea uno nuevo.
 *
 * NUNCA throw — best-effort. El caller decide si bloquear o degradar.
 */

import 'server-only'
import { adminDb } from '@/lib/firebase/admin'
import { getOdooClient } from '@/lib/odoo/client'

const APP_CONFIG_COLLECTION = 'appConfig'
const APP_CONFIG_ODOO_DOC = 'odoo'
const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_NULL_TTL_MS = 30 * 1000

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

const MONTHS_ES_UPPER = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
] as const

export type ResolveSource =
  | 'canonical-tag'
  | 'fallback-create'
  | 'disabled'
  | 'no-match'
  | 'error'

export interface ResolveFolderInput {
  tripDestino: string
  paymentDate: Date
}

export interface ResolveFolderResult {
  folderId: number | null
  source: ResolveSource
  normalizedKey: string
  error?: string
}

// =====================================================================
// Config cache
// =====================================================================

interface ConfigCacheEntry {
  config: {
    folderAutoAssign: boolean
    folderAutoCreate: boolean
    folderCanonicoTagId: number | null
  }
  expiresAt: number
}

let configCache: ConfigCacheEntry | null = null

/** @internal Reset para tests. */
export function resetFolderCanonicalCache(): void {
  configCache = null
  canonicalCache = null
}

async function readConfig(): Promise<ConfigCacheEntry['config']> {
  const now = Date.now()
  if (configCache && configCache.expiresAt > now) {
    return configCache.config
  }
  try {
    const snap = await adminDb
      .collection(APP_CONFIG_COLLECTION)
      .doc(APP_CONFIG_ODOO_DOC)
      .get()
    const data = snap.exists ? snap.data() : null
    const config = {
      folderAutoAssign: data?.folderAutoAssign === true,
      folderAutoCreate: data?.folderAutoCreate === true,
      folderCanonicoTagId:
        typeof data?.folderCanonicoTagId === 'number' &&
        Number.isInteger(data.folderCanonicoTagId) &&
        data.folderCanonicoTagId > 0
          ? data.folderCanonicoTagId
          : null,
    }
    configCache = { config, expiresAt: now + CACHE_TTL_MS }
    return config
  } catch (err) {
    console.warn('[folder-canonical] readConfig falló — degraded', {
      error: err instanceof Error ? err.message : String(err),
    })
    const config = {
      folderAutoAssign: false,
      folderAutoCreate: false,
      folderCanonicoTagId: null,
    }
    configCache = { config, expiresAt: now + CACHE_NULL_TTL_MS }
    return config
  }
}

// =====================================================================
// Canónicos cache (folder id por normalizedKey)
// =====================================================================

interface CanonicalEntry {
  byKey: Map<string, number>
  expiresAt: number
}

let canonicalCache: CanonicalEntry | null = null

async function readCanonicals(tagId: number): Promise<Map<string, number>> {
  const now = Date.now()
  if (canonicalCache && canonicalCache.expiresAt > now) {
    return canonicalCache.byKey
  }
  const client = getOdooClient()
  const rows = (await client.searchRead(
    'documents.document',
    [
      ['type', '=', 'folder'],
      ['tag_ids', 'in', [tagId]],
    ],
    ['id', 'name'],
    { limit: 500 },
  )) as Array<Record<string, unknown>>

  const byKey = new Map<string, number>()
  for (const row of rows) {
    const id = row.id
    const name = row.name
    if (typeof id !== 'number' || typeof name !== 'string') continue
    const key = normalizeFolderName(name)
    // Si hay duplicados con el mismo tag canónico (anomalía), gana el id más bajo (más antiguo).
    const existing = byKey.get(key)
    if (existing === undefined || id < existing) {
      byKey.set(key, id)
    }
  }
  canonicalCache = { byKey, expiresAt: now + CACHE_TTL_MS }
  return byKey
}

// =====================================================================
// Normalizer (mismo que el script de audit)
// =====================================================================

/**
 * Normaliza el nombre de un folder para identificar el cluster.
 * Reglas:
 *  - lowercase
 *  - strip diacríticos (NFD)
 *  - colapsar espacios múltiples a uno
 *  - quitar dígitos finales pegados al sufijo (`MAYO1` → `MAYO`)
 *  - trim
 */
export function normalizeFolderName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks (acentos)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/([a-zñ])\d+/g, '$1') // strip dígitos pegados a letra (MAYO1 → MAYO), preserva años (espacio antes)
    .trim()
}

export function buildNormalizedKey(
  tripDestino: string,
  paymentDate: Date,
): string {
  const month = MONTHS_ES[paymentDate.getUTCMonth()]
  const year = paymentDate.getUTCFullYear()
  return normalizeFolderName(`${tripDestino} ${month} ${year}`)
}

function buildCanonicalNameForCreate(
  tripDestino: string,
  paymentDate: Date,
): string {
  const month = MONTHS_ES_UPPER[paymentDate.getUTCMonth()]
  const year = paymentDate.getUTCFullYear()
  return `${tripDestino.toUpperCase()} ${month} ${year}`
}

// =====================================================================
// Main
// =====================================================================

export async function resolveCanonicalFolderId(
  input: ResolveFolderInput,
): Promise<ResolveFolderResult> {
  const { tripDestino, paymentDate } = input
  const normalizedKey = buildNormalizedKey(tripDestino, paymentDate)

  if (!tripDestino || tripDestino.trim().length === 0) {
    return { folderId: null, source: 'no-match', normalizedKey }
  }
  if (!(paymentDate instanceof Date) || Number.isNaN(paymentDate.getTime())) {
    return { folderId: null, source: 'no-match', normalizedKey }
  }

  const config = await readConfig()
  if (!config.folderAutoAssign || config.folderCanonicoTagId === null) {
    return { folderId: null, source: 'disabled', normalizedKey }
  }

  try {
    const canonicals = await readCanonicals(config.folderCanonicoTagId)
    const match = canonicals.get(normalizedKey)
    if (match !== undefined) {
      return { folderId: match, source: 'canonical-tag', normalizedKey }
    }

    if (!config.folderAutoCreate) {
      return { folderId: null, source: 'no-match', normalizedKey }
    }

    // Fallback: crear folder nuevo + tag canónico.
    const client = getOdooClient()
    const newName = buildCanonicalNameForCreate(tripDestino, paymentDate)
    const createdId = await client.create('documents.document', {
      name: newName,
      type: 'folder',
      tag_ids: [[6, 0, [config.folderCanonicoTagId]]],
    })
    if (!Number.isInteger(createdId) || (createdId as number) <= 0) {
      return {
        folderId: null,
        source: 'error',
        normalizedKey,
        error: `Odoo retornó id inválido: ${String(createdId)}`,
      }
    }
    // Invalidar cache canónicos para que la próxima query lo vea.
    canonicalCache = null
    return {
      folderId: createdId as number,
      source: 'fallback-create',
      normalizedKey,
    }
  } catch (err) {
    return {
      folderId: null,
      source: 'error',
      normalizedKey,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
