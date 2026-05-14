/**
 * Helpers para generación de CSV seguro.
 * Escapa valores con coma, comillas dobles o saltos de línea según RFC 4180.
 */

export function csvEscape(value: unknown): string {
  if (value == null) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(',')
}
