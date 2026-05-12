import { z } from 'zod'
import { lwwPaymentFieldSchema, syncSourceSchema } from './paymentSchema'

/**
 * Cola de conflictos LWW Firestore↔Odoo.
 * Story 9.3 (pull) detecta concurrent writes en campos LWW y crea un doc aquí.
 * Story 9.6 (UI admin) lista y permite resolver eligiendo `firestore` u `odoo`.
 *
 * Colección Firestore: `paymentConflicts/{conflictId}` (NO por paymentId — un pago
 * puede tener varios conflictos abiertos en campos distintos).
 */

const conflictTimestamp = z.union([z.date(), z.string()])

/** Resolución elegida por el admin. */
export const CONFLICT_RESOLUTIONS = ['firestore', 'odoo', 'custom'] as const
export type ConflictResolution = (typeof CONFLICT_RESOLUTIONS)[number]
export const conflictResolutionSchema = z.enum(CONFLICT_RESOLUTIONS)

/**
 * Schema del doc Firestore `paymentConflicts/{conflictId}`.
 * `firestoreValue` y `odooValue` quedan como `unknown` porque el tipo concreto
 * depende del `field` (number para amount, string para memo, Date/string para date).
 * El UI de resolución (9.6) hace el cast tipado según `field`.
 */
/**
 * Helper: valida que un valor matchee el tipo esperado del campo LWW.
 * - `amount`: integer positivo (centavos)
 * - `memo`: string
 * - `paymentDate`: Date | string ISO | Firestore Timestamp ({seconds,nanoseconds})
 */
function isValueTypeForField(field: string, value: unknown): boolean {
  if (field === 'amount') {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0
  }
  if (field === 'memo') {
    return typeof value === 'string'
  }
  if (field === 'paymentDate') {
    if (value instanceof Date) return true
    if (typeof value === 'string') return value.length > 0
    if (typeof value === 'object' && value !== null) {
      const v = value as Record<string, unknown>
      return typeof v.seconds === 'number' && typeof v.nanoseconds === 'number'
    }
    return false
  }
  return false
}

/** Refines compartidos entre paymentConflictSchema y createPaymentConflictSchema. */
const valueTypeRefines = <T extends { field: string; firestoreValue: unknown; odooValue: unknown }>(
  schema: z.ZodType<T>,
) =>
  schema
    .refine((d) => isValueTypeForField(d.field, d.firestoreValue), {
      message: 'firestoreValue no matchea el tipo esperado del field',
      path: ['firestoreValue'],
    })
    .refine((d) => isValueTypeForField(d.field, d.odooValue), {
      message: 'odooValue no matchea el tipo esperado del field',
      path: ['odooValue'],
    })

const paymentConflictBase = z.object({
  paymentId: z.string().min(1),
  field: lwwPaymentFieldSchema,
  firestoreValue: z.unknown(),
  odooValue: z.unknown(),
  firestoreWrittenAt: conflictTimestamp,
  odooWrittenAt: conflictTimestamp,
  firestoreSource: syncSourceSchema.optional(),
  odooSource: syncSourceSchema.optional(),
  detectedAt: conflictTimestamp,
  resolvedAt: conflictTimestamp.nullable().optional(),
  resolvedBy: z.string().max(128).nullable().optional(),
  resolution: conflictResolutionSchema.nullable().optional(),
  resolutionValue: z.unknown().optional(),
  resolutionNote: z.string().max(500).nullable().optional(),
})

export const paymentConflictSchema = valueTypeRefines(paymentConflictBase)

export type PaymentConflict = z.infer<typeof paymentConflictSchema>

/** Schema para crear un conflicto (writes desde 9.3). `detectedAt` lo agrega el sync. */
export const createPaymentConflictSchema = valueTypeRefines(
  paymentConflictBase.pick({
    paymentId: true,
    field: true,
    firestoreValue: true,
    odooValue: true,
    firestoreWrittenAt: true,
    odooWrittenAt: true,
    firestoreSource: true,
    odooSource: true,
  }),
)

export type CreatePaymentConflict = z.infer<typeof createPaymentConflictSchema>

/** Schema para resolver un conflicto (PATCH desde UI 9.6). */
export const resolvePaymentConflictSchema = z
  .object({
    resolution: conflictResolutionSchema,
    resolutionValue: z.unknown().optional(),
    resolutionNote: z.string().max(500).optional(),
  })
  .refine(
    (data) => data.resolution !== 'custom' || data.resolutionValue !== undefined,
    {
      message: 'resolutionValue es obligatorio cuando resolution = "custom"',
      path: ['resolutionValue'],
    },
  )

export type ResolvePaymentConflict = z.infer<typeof resolvePaymentConflictSchema>
