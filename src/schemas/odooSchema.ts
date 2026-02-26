import { z } from 'zod'
import { Timestamp } from 'firebase-admin/firestore'

// --- API Input Schemas ---

export const odooSearchReadSchema = z.object({
  model: z.string().min(1, 'model es requerido'),
  domain: z.array(z.unknown()).default([]),
  fields: z.array(z.string()).min(1, 'Al menos un field es requerido'),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
  order: z.string().optional(),
})

export type OdooSearchReadInput = z.infer<typeof odooSearchReadSchema>

// --- Transformation Helpers ---

export function odooAmountToCentavos(amount: unknown): number {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount))
  if (Number.isNaN(num)) return 0
  return Math.round(num * 100)
}

export function odooDateToTimestamp(odooDate: unknown): Timestamp | null {
  if (typeof odooDate !== 'string' || !odooDate) return null
  const iso = odooDate.replace(' ', 'T') + 'Z'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return Timestamp.fromDate(date)
}

export function odooFieldToCamelCase(field: string): string {
  return field.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())
}

export function odooFieldsToOdooPrefixed(
  record: Record<string, unknown>,
  fieldMap: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [odooField, firestoreField] of Object.entries(fieldMap)) {
    if (odooField in record) {
      result[firestoreField] = record[odooField]
    }
  }
  return result
}
