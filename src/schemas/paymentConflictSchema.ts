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
export const paymentConflictSchema = z.object({
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

export type PaymentConflict = z.infer<typeof paymentConflictSchema>

/** Schema para crear un conflicto (writes desde 9.3). `detectedAt` lo agrega el sync. */
export const createPaymentConflictSchema = paymentConflictSchema.pick({
  paymentId: true,
  field: true,
  firestoreValue: true,
  odooValue: true,
  firestoreWrittenAt: true,
  odooWrittenAt: true,
  firestoreSource: true,
  odooSource: true,
})

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
