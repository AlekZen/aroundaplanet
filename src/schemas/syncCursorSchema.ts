import { z } from 'zod'

/**
 * Cursor persistido en `syncCursors/{cursorId}` por cada pipeline de sync.
 * Story 9.3 escribe `syncCursors/odooPayments` tras cada polling run.
 *
 * Formato `lastCursor`: string ISO Odoo `YYYY-MM-DD HH:MM:SS` (UTC, sin sufijo)
 * o `null` para indicar "primer run nunca ejecutado" → default 24h hacia atrás
 * salvo bootstrap explícito (`lastCursor='1970-01-01 00:00:00'`).
 */

const cursorTimestamp = z.union([z.date(), z.string()])

export const syncCursorSummarySchema = z
  .object({
    fetched: z.number().int().min(0),
    matched: z.number().int().min(0),
    updated: z.number().int().min(0),
    conflicts: z.number().int().min(0),
    alerts: z.number().int().min(0),
    unmatched: z.number().int().min(0),
    validationFailures: z.number().int().min(0),
    durationMs: z.number().int().min(0),
  })
  .partial()

export type SyncCursorSummary = z.infer<typeof syncCursorSummarySchema>

export const syncCursorSchema = z.object({
  lastCursor: z.string().nullable(),
  lastRunAt: cursorTimestamp.nullable().optional(),
  lastRunSummary: syncCursorSummarySchema.nullable().optional(),
  lastError: z.string().max(2000).nullable().optional(),
  lastErrorAt: cursorTimestamp.nullable().optional(),
})

export type SyncCursor = z.infer<typeof syncCursorSchema>

/** Default cursor cuando no existe doc Firestore (24h hacia atrás en formato Odoo UTC). */
export function defaultCursor24hAgo(now: Date = new Date()): string {
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  return formatOdooDateTime(past)
}

/** Bootstrap explícito desde epoch (opt-in vía body del scheduler endpoint). */
export const BOOTSTRAP_EPOCH_CURSOR = '1970-01-01 00:00:00'

/** Formatea Date a `YYYY-MM-DD HH:MM:SS` UTC sin sufijo (matchea Odoo write_date). */
export function formatOdooDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  )
}
