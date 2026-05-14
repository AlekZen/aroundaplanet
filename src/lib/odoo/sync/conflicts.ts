/**
 * Detección de conflictos LWW Firestore ↔ Odoo (Story 9.3, AC4).
 *
 * Resoluciones posibles:
 *  - `noop`         → ambos valores iguales, no escribir
 *  - `odoo_wins`    → Paloma escribió después del último cursor sin que Firestore tocara,
 *                     sobrescribir mirror con valor Odoo + source='odoo'
 *  - `firestore_wins` → Firestore escribió más reciente que Odoo, skip (el push ya empujará)
 *  - `conflict`     → AMBOS escribieron entre syncs → encolar en paymentConflicts/
 *
 * Reglas:
 *  - Tolerancia de skew: 30s (no consideramos newer si la diferencia es <30s)
 *  - `firestoreLww == null` → odoo_wins (mirror inicial)
 *  - Valores iguales → noop
 *  - Solo es conflicto verdadero si `firestoreLww.writtenAt > lastCursor` (Firestore escribió
 *    en la ventana entre el último sync y ahora, simultáneo con Odoo)
 */

import { toEpochMs, type AnyTimestamp } from './time'
import type { LwwPaymentField, SyncSource } from '@/schemas/paymentSchema'

export const LWW_SKEW_TOLERANCE_MS = 30_000

export interface LwwSubdoc {
  value: unknown
  writtenAt: AnyTimestamp
  source?: SyncSource
}

export interface DetectLwwInput {
  field: LwwPaymentField
  firestoreLww: LwwSubdoc | null | undefined
  odooValue: unknown
  odooWriteDate: AnyTimestamp
  lastCursor: AnyTimestamp
}

export type LwwResolution = 'noop' | 'odoo_wins' | 'firestore_wins' | 'conflict'

export interface DetectLwwResult {
  resolution: LwwResolution
  /** Cuando resolution = 'odoo_wins', el subdoc a escribir. */
  odooLww?: { value: unknown; writtenAt: AnyTimestamp; source: 'odoo' }
}

/**
 * Compara valores LWW según tipo del campo.
 * - amount: int centavos, tolerancia ±1 cent por floating-point conversion
 * - paymentDate: comparar como YYYY-MM-DD (string) tras normalizar
 * - memo: string trimmed case-sensitive
 */
export function valuesEqualForField(field: LwwPaymentField, a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false

  if (field === 'amount') {
    const na = Number(a)
    const nb = Number(b)
    if (!Number.isFinite(na) || !Number.isFinite(nb)) return false
    return Math.abs(na - nb) <= 1
  }

  if (field === 'memo') {
    return String(a).trim() === String(b).trim()
  }

  if (field === 'paymentDate') {
    return normalizeDateStr(a) === normalizeDateStr(b)
  }

  return a === b
}

function normalizeDateStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') {
    // YYYY-MM-DD ya está normalizado
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  }
  const ms = toEpochMs(v as AnyTimestamp)
  if (!ms) return ''
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function detectLwwConflict(input: DetectLwwInput): DetectLwwResult {
  const { field, firestoreLww, odooValue, odooWriteDate, lastCursor } = input

  // 1. Sin LWW Firestore previo → Odoo se vuelve la fuente inicial.
  if (firestoreLww == null) {
    return {
      resolution: 'odoo_wins',
      odooLww: { value: odooValue, writtenAt: odooWriteDate, source: 'odoo' },
    }
  }

  // 2. Mismo valor → no-op idempotente.
  if (valuesEqualForField(field, firestoreLww.value, odooValue)) {
    return { resolution: 'noop' }
  }

  const odooMs = toEpochMs(odooWriteDate)
  const firestoreMs = toEpochMs(firestoreLww.writtenAt)
  const cursorMs = toEpochMs(lastCursor)

  // 3. Si Odoo NO es más nuevo (tolerancia 30s) → Firestore más reciente, skip.
  const odooNewer = odooMs > firestoreMs + LWW_SKEW_TOLERANCE_MS
  if (!odooNewer) {
    return { resolution: 'firestore_wins' }
  }

  // 4. Odoo es más nuevo. Pero ¿Firestore escribió desde el último cursor?
  //    Si sí → conflicto verdadero (ambos modificaron entre syncs).
  //    Si no → Odoo gana limpio.
  const firestoreWroteSinceLastSync = firestoreMs > cursorMs && firestoreMs > 0
  if (firestoreWroteSinceLastSync) {
    return { resolution: 'conflict' }
  }

  return {
    resolution: 'odoo_wins',
    odooLww: { value: odooValue, writtenAt: odooWriteDate, source: 'odoo' },
  }
}
