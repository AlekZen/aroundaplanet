import { z } from 'zod'

/**
 * Story 10.1 — Instancia de contrato generado.
 * Snapshot inmutable de los datos al momento de generar el PDF.
 * Si Paloma corrige algo y regenera → se crea NUEVO doc con version++ (NO se modifica el anterior).
 */
export const contractSnapshotSchema = z.object({
  nombreCliente: z.string().trim().min(2).max(200),
  nombreAcompanantes: z.string().trim().max(300).nullable().optional(),
  viajeDestino: z.string().trim().min(1).max(120),
  viajeTemporada: z.string().trim().min(1).max(120),
  periodoViaje: z.string().trim().max(200).nullable().optional(),
  fechaSalida: z.string().trim().nullable().optional(),
  fechaRegreso: z.string().trim().nullable().optional(),
  montoTotalCents: z.number().int().positive('Monto debe ser > 0'),
  montoTotalFormatted: z.string().min(1),
  montoTotalLetras: z.string().min(1),
  anticipoCents: z.number().int().nonnegative().nullable().optional(),
  anticipoFormatted: z.string().nullable().optional(),
  anticipoLetras: z.string().nullable().optional(),
  saldoCents: z.number().int().nonnegative().nullable().optional(),
  saldoFormatted: z.string().nullable().optional(),
  agenteId: z.string().max(128).nullable().optional(),
  agenteName: z.string().max(200).nullable().optional(),
  ciudadFirma: z.string().max(80).default('Ocotlán, Jalisco'),
})

export type ContractSnapshot = z.infer<typeof contractSnapshotSchema>

export const createContractSchema = z.object({
  templateId: z.string().min(1, 'templateId requerido'),
  snapshotOverrides: contractSnapshotSchema.partial().optional(),
})

export type CreateContractInput = z.infer<typeof createContractSchema>

export const contractDocumentSchema = z.object({
  contractId: z.string().min(1),
  orderId: z.string().min(1),
  templateId: z.string().min(1),
  templateKey: z.string().min(1),
  snapshot: contractSnapshotSchema,
  pdfUrl: z.string().url(),
  pdfStoragePath: z.string().min(1),
  generatedBy: z.string().min(1),
  generatedByName: z.string().max(200).nullable().optional(),
  version: z.number().int().positive(),
  // === Sharing (Story 10.1 — sesión 43) ===
  // Denormalizados desde la orden al momento de generar el contrato para que
  // las queries `where clientUserId == uid` no requieran join.
  clientUserId: z.string().min(1).nullable(),
  agentId: z.string().min(1).nullable(),
  sharedWithClient: z.boolean().default(false),
  sharedWithAgent: z.boolean().default(false),
  // === Aceptación simple (NO firma electrónica SAT — evidencia de aceptación) ===
  acceptedAt: z.unknown().nullable().optional(),
  acceptedByUid: z.string().nullable().optional(),
  acceptedByName: z.string().max(200).nullable().optional(),
  acceptedIp: z.string().max(64).nullable().optional(),
})

export type ContractDocument = z.infer<typeof contractDocumentSchema>

export const shareContractSchema = z.object({
  sharedWithClient: z.boolean().optional(),
  sharedWithAgent: z.boolean().optional(),
}).refine(
  (d) => d.sharedWithClient !== undefined || d.sharedWithAgent !== undefined,
  { message: 'Debe especificar al menos un campo a actualizar' }
)

export type ShareContractInput = z.infer<typeof shareContractSchema>
