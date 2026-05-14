/**
 * Normalización de timestamps para sync Firestore ↔ Odoo.
 *
 * `firestoreLww.writtenAt` puede llegar como Date, string ISO, o
 * `{seconds, nanoseconds}` (shape Firestore Timestamp). Odoo siempre envía
 * `write_date` como string `YYYY-MM-DD HH:MM:SS` UTC sin sufijo de timezone.
 * El cursor también viaja como string.
 *
 * Comparar Date > string es NaN (coerce a number falla). Antes de cualquier
 * comparación temporal en el pull, normalizar a epoch ms con `toEpochMs`.
 */

export type AnyTimestamp =
  | Date
  | string
  | number
  | { seconds: number; nanoseconds?: number; toDate?: () => Date }
  | null
  | undefined

/**
 * Convierte cualquier representación de timestamp a epoch ms.
 * - `null`/`undefined` → 0 (tratar como "muy antiguo")
 * - `number` → asume ya es epoch ms
 * - `Date` → `.getTime()`
 * - `string` ISO con sufijo (`Z`/`+`/`-`) → `Date.parse`
 * - `string` Odoo `YYYY-MM-DD HH:MM:SS` (sin sufijo, UTC implícito) → parsea como UTC
 * - `{seconds, nanoseconds}` → Firestore Timestamp shape
 *
 * Retorna 0 si no logra parsear (NUNCA NaN — eso rompe comparaciones).
 */
export function toEpochMs(t: AnyTimestamp): number {
  if (t == null) return 0
  if (typeof t === 'number') return Number.isFinite(t) ? t : 0
  if (t instanceof Date) {
    const ms = t.getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  if (typeof t === 'string') return parseStringTimestamp(t)
  if (typeof t === 'object') {
    if (typeof t.toDate === 'function') {
      try {
        const d = t.toDate()
        return d instanceof Date && Number.isFinite(d.getTime()) ? d.getTime() : 0
      } catch {
        // fall through a seconds/nanoseconds
      }
    }
    if (typeof t.seconds === 'number') {
      const nanos = typeof t.nanoseconds === 'number' ? t.nanoseconds : 0
      return t.seconds * 1000 + Math.floor(nanos / 1_000_000)
    }
  }
  return 0
}

function parseStringTimestamp(s: string): number {
  const trimmed = s.trim()
  if (!trimmed) return 0
  // Si ya viene con sufijo Z/+HH:MM/-HH:MM → Date.parse lo entiende
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const ms = Date.parse(trimmed)
    return Number.isFinite(ms) ? ms : 0
  }
  // Formato Odoo `YYYY-MM-DD HH:MM:SS` (sin sufijo) → asumir UTC
  const odooMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/,
  )
  if (odooMatch) {
    const [, y, mo, d, h, mi, se, ms = '0'] = odooMatch
    const epoch = Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(se),
      Number(ms.padEnd(3, '0').slice(0, 3)),
    )
    return Number.isFinite(epoch) ? epoch : 0
  }
  // Formato fecha pura `YYYY-MM-DD` (Odoo `date` field) → medianoche UTC
  const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateMatch) {
    const [, y, mo, d] = dateMatch
    const epoch = Date.UTC(Number(y), Number(mo) - 1, Number(d))
    return Number.isFinite(epoch) ? epoch : 0
  }
  // Fallback: Date.parse (cubre ISO sin sufijo en navegadores tolerantes, etc.)
  const ms = Date.parse(trimmed)
  return Number.isFinite(ms) ? ms : 0
}
