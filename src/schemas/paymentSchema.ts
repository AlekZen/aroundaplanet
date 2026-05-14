import { z } from 'zod'

/** All valid payment statuses */
export const PAYMENT_STATUSES = [
  'pending_verification',
  'verified',
  'rejected',
  'info_requested',
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/** Valid payment methods */
export const PAYMENT_METHODS = [
  'transfer',
  'card',
  'cash',
  'deposit',
  'agent_collected',
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Human-readable labels for payment statuses */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending_verification: 'Pendiente',
  verified: 'Verificado',
  rejected: 'Rechazado',
  info_requested: 'Info Solicitada',
}

/** Human-readable labels for payment methods */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transfer: 'Transferencia',
  card: 'Tarjeta',
  cash: 'Efectivo',
  deposit: 'Deposito',
  agent_collected: 'Cobro por Agente',
}

export const paymentStatusSchema = z.enum(PAYMENT_STATUSES)
export const paymentMethodSchema = z.enum(PAYMENT_METHODS)

/** Schema for POST /api/payments — create a payment report */
export const createPaymentSchema = z.object({
  orderId: z.string().min(1, 'orderId es requerido'),
  amountCents: z.number().int().positive('El monto debe ser mayor a 0'),
  paymentMethod: paymentMethodSchema,
  date: z.string().min(1, 'La fecha del pago es requerida'),
  receiptUrl: z.string().url().optional(),
  bankName: z.string().max(100).optional(),
  bankReference: z.string().max(100).optional(),
  beneficiaryName: z.string().max(200).optional(),
  concept: z.string().max(300).optional(),
  sourceAccount: z.string().max(20).optional(),
  destinationAccount: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
})

export type CreatePaymentFormData = z.infer<typeof createPaymentSchema>

/** Schema for PATCH /api/payments/[paymentId]/verify — admin action */
export const verifyPaymentSchema = z.object({
  action: z.enum(['verify', 'reject', 'request_info']),
  rejectionNote: z.string().min(5, 'El motivo debe tener al menos 5 caracteres').optional(),
}).refine(
  (data) => data.action !== 'reject' || (data.rejectionNote && data.rejectionNote.length >= 5),
  { message: 'Motivo de rechazo es obligatorio', path: ['rejectionNote'] }
)

export type VerifyPaymentFormData = z.infer<typeof verifyPaymentSchema>

/** Schema for GET /api/payments query params */
export const paymentListQuerySchema = z.object({
  status: paymentStatusSchema.optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
})

// =====================================================================
// Epic 9: Sync bidireccional Firestore ↔ Odoo ↔ Documents
// =====================================================================

/**
 * Estado contable Odoo del account.payment, reflejado read-only en Firestore.
 * Fuente: Odoo 18 account.payment.state.
 */
export const ODOO_PAYMENT_STATES = [
  'draft',
  'in_process',
  'paid',
  'canceled',
  'rejected',
] as const

export type OdooPaymentState = (typeof ODOO_PAYMENT_STATES)[number]

export const odooPaymentStateSchema = z.enum(ODOO_PAYMENT_STATES)

/**
 * Estado del sync Firestore→Odoo del pago.
 * - never_synced: pago capturado, aún no verificado (no debe estar en Odoo)
 * - pending: verificado, encolado para push, aún sin odooPaymentId
 * - synced: creado en Odoo, odooPaymentId presente, sin drift detectado
 * - error: último push falló, ver odooLastError + syncRetryCount
 * - orphan: account.payment creado pero ir.model.data falló (recovery manual)
 * - legacy_linked: pago pre-existente Odoo enlazado por reconciliación retroactiva (sin ir.model.data)
 */
export const ODOO_SYNC_STATUSES = [
  'never_synced',
  'pending',
  'synced',
  'error',
  'orphan',
  'legacy_linked',
  'dismissed',
] as const

export type OdooSyncStatus = (typeof ODOO_SYNC_STATUSES)[number]

export const odooSyncStatusSchema = z.enum(ODOO_SYNC_STATUSES)

/**
 * Origen del último write de un campo LWW.
 * Permite detectar conflictos cuando ambos lados escribieron entre syncs.
 */
export const SYNC_SOURCES = ['firestore', 'odoo'] as const
export type SyncSource = (typeof SYNC_SOURCES)[number]
export const syncSourceSchema = z.enum(SYNC_SOURCES)

/**
 * Shape duck-typed de un Firestore `Timestamp` instance.
 * Tanto `firebase-admin/firestore` como `firebase/firestore` exponen
 * `{seconds, nanoseconds}` con métodos adicionales (`toDate`, `toMillis`).
 * Validamos solo los dos campos numéricos — `passthrough` deja pasar los métodos.
 */
const firestoreTimestampSchema = z
  .object({
    seconds: z.number().int(),
    nanoseconds: z.number().int().min(0).max(999_999_999),
  })
  .passthrough()

/**
 * Wrapper LWW para campos editables en ambos lados (memo, paymentDate, amount).
 * `writtenAt` se compara entre Firestore y Odoo para detectar concurrent writes.
 * Acepta `Date | string ISO | Firestore.Timestamp` para cubrir los 3 shapes
 * vistos en runtime (writes locales / serialización JSON / reads Firestore SDK).
 * Los writes a Firestore deben convertir a Timestamp (regla CLAUDE.md — NUNCA ISO).
 */
const lwwTimestamp = z.union([z.date(), z.string(), firestoreTimestampSchema])

export const lwwValueSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema,
    writtenAt: lwwTimestamp,
    source: syncSourceSchema,
  })

/**
 * Campos LWW del pago (los que pueden cambiar en ambos lados).
 * `amount` siempre en centavos enteros (regla del proyecto).
 */
export const paymentLwwFieldsSchema = z.object({
  amount: lwwValueSchema(z.number().int().positive()),
  paymentDate: lwwValueSchema(z.union([z.date(), z.string().min(1)])),
  memo: lwwValueSchema(z.string().max(500)),
})

export type PaymentLwwFields = z.infer<typeof paymentLwwFieldsSchema>

/**
 * Bloque de campos sync que viven en el documento Firestore `payments/{paymentId}`.
 * TODOS opcionales para no romper documentos existentes (migración lazy).
 *
 * Reglas de ownership:
 * - `odoo*` mirrors: escritos SOLO por el pull (Story 9.3). Read-only desde Firestore UI.
 * - `odooSyncStatus`, `odooSyncedAt`, `odooLastError`, `syncRetryCount`: escritos
 *   por las Cloud Functions de push/pull (Stories 9.2, 9.3).
 * - `linkedAt`, `linkedBy`: escritos por la reconciliación retroactiva (Story 9.1).
 */
export const paymentOdooSyncSchema = z.object({
  // === Bridge / identidad ===
  odooPaymentId: z.number().int().positive().nullable().optional(),

  // === Mirror read-only del estado contable Odoo ===
  odooState: odooPaymentStateSchema.nullable().optional(),
  odooJournalId: z.number().int().positive().nullable().optional(),
  odooJournalName: z.string().max(200).nullable().optional(),
  // memo cruzado vive en lww.memo con source='odoo' — NO duplicar como odooMemo
  odooReconciled: z.boolean().optional(),
  odooReconciledInvoiceIds: z.array(z.number().int().positive()).optional(),
  odooCanceledAt: lwwTimestamp.nullable().optional(),

  // === Documents app (Story 9.4) ===
  odooFolderId: z.number().int().positive().nullable().optional(),
  odooFolderName: z.string().max(200).nullable().optional(),
  odooDocumentId: z.number().int().positive().nullable().optional(),
  odooAttachmentIds: z.array(z.number().int().positive()).optional(),

  // === Dedup (Story 9.1) ===
  isCanonicalDuplicate: z.boolean().optional(),
  canonicalPaymentOdooId: z.number().int().positive().nullable().optional(),

  // === Sync metadata ===
  odooSyncStatus: odooSyncStatusSchema.optional(),
  odooSyncedAt: lwwTimestamp.nullable().optional(),
  odooLastError: z.string().max(2000).nullable().optional(),
  syncRetryCount: z.number().int().min(0).optional(),

  // === Dismissed (Story 9.6) ===
  odooSyncDismissedAt: lwwTimestamp.nullable().optional(),
  odooSyncDismissedBy: z.string().max(128).nullable().optional(),
  odooSyncDismissedReason: z.string().max(500).nullable().optional(),

  // === Reconciliación retroactiva (Story 9.1) ===
  linkedAt: lwwTimestamp.nullable().optional(),
  linkedBy: z.string().max(128).nullable().optional(),
  linkMatchConfidence: z.enum(['high', 'medium', 'low', 'manual']).optional(),

  // === LWW (memo, date, amount) — opcional para back-compat ===
  lww: paymentLwwFieldsSchema.partial().optional(),
})
  .refine(
    (d) => d.odooSyncStatus !== 'synced' || (d.odooPaymentId ?? null) !== null,
    {
      message: 'odooSyncStatus="synced" requiere odooPaymentId no-null',
      path: ['odooPaymentId'],
    },
  )
  .refine(
    (d) => d.odooSyncStatus !== 'legacy_linked' || (d.odooPaymentId ?? null) !== null,
    {
      message: 'odooSyncStatus="legacy_linked" requiere odooPaymentId no-null',
      path: ['odooPaymentId'],
    },
  )
  .refine(
    (d) => d.odooSyncStatus !== 'legacy_linked' || d.linkedAt != null,
    {
      message: 'odooSyncStatus="legacy_linked" requiere linkedAt',
      path: ['linkedAt'],
    },
  )
  .refine(
    (d) => d.odooSyncStatus !== 'error' || (d.odooLastError ?? null) !== null,
    {
      message: 'odooSyncStatus="error" requiere odooLastError',
      path: ['odooLastError'],
    },
  )
  .refine(
    (d) => d.odooReconciled !== true || (d.odooReconciledInvoiceIds?.length ?? 0) > 0,
    {
      message: 'odooReconciled=true requiere al menos un odooReconciledInvoiceIds',
      path: ['odooReconciledInvoiceIds'],
    },
  )
  .refine(
    (d) => d.odooSyncStatus !== 'dismissed' || (d.odooSyncDismissedReason ?? '').length >= 5,
    {
      message: 'odooSyncStatus="dismissed" requiere odooSyncDismissedReason (min 5 chars)',
      path: ['odooSyncDismissedReason'],
    },
  )

export type PaymentOdooSync = z.infer<typeof paymentOdooSyncSchema>

// =====================================================================
// Field-ownership matrix — qué lado manda por campo
// =====================================================================

/**
 * Ownership de un campo lógico del pago:
 * - `firestore`: Firestore es source of truth, Odoo no lo conoce o lo refleja read-only.
 * - `odoo`: Odoo es source of truth, Firestore proyecta mirror read-only.
 * - `lww`: ambos pueden escribir, gana el `writtenAt` mayor; conflictos se encolan
 *   en `paymentConflicts/{paymentId}` para resolución manual.
 * - `bridge`: campo de identidad/metadata del sync, lo escribe el sync mismo.
 */
export type FieldOwnership = 'firestore' | 'odoo' | 'lww' | 'bridge'

/**
 * Matriz canónica field-ownership del pago.
 * Fuente: research técnico Epic 9, sección "Matriz Field-Ownership" (Punto 8).
 *
 * Las claves son strings descriptivos del campo lógico, NO necesariamente
 * el path Firestore literal (porque algunos campos viven en Firestore-owned
 * sin mirror Odoo y viceversa).
 *
 * NUNCA modificar sin actualizar también:
 *   - paymentOdooSyncSchema (este archivo)
 *   - Story 9.7 runbook
 *   - Stories 9.2 (push), 9.3 (pull): contratos de qué escribir
 */
export const PAYMENT_FIELD_OWNERSHIP = {
  // Identidad (bridge)
  firestoreId: 'bridge',
  odooPaymentId: 'bridge',
  linkedAt: 'bridge',
  linkedBy: 'bridge',
  linkMatchConfidence: 'bridge',

  // Firestore-owned (puro Firestore)
  agentId: 'firestore',
  agentName: 'firestore',
  clientId: 'firestore',
  clientName: 'firestore',
  clientPhone: 'firestore',
  status: 'firestore',
  paymentMethod: 'firestore',
  receiptUrl: 'firestore',
  ocrData: 'firestore',
  verifiedBy: 'firestore',
  verifiedAt: 'firestore',
  rejectionReason: 'firestore',

  // LWW (ambos lados editan)
  amount: 'lww',
  paymentDate: 'lww',
  memo: 'lww',

  // Odoo-owned (mirror read-only en Firestore)
  odooState: 'odoo',
  odooJournalId: 'odoo',
  odooJournalName: 'odoo',
  odooReconciled: 'odoo',
  odooReconciledInvoiceIds: 'odoo',
  odooCanceledAt: 'odoo',
  odooFolderId: 'odoo',
  odooFolderName: 'odoo',
  odooDocumentId: 'odoo',
  odooAttachmentIds: 'odoo',
  isCanonicalDuplicate: 'odoo',
  canonicalPaymentOdooId: 'odoo',

  // Sync metadata (bridge)
  odooSyncStatus: 'bridge',
  odooSyncedAt: 'bridge',
  odooLastError: 'bridge',
  syncRetryCount: 'bridge',

  // Dismissed metadata (bridge — Story 9.6)
  odooSyncDismissedAt: 'bridge',
  odooSyncDismissedBy: 'bridge',
  odooSyncDismissedReason: 'bridge',
} as const satisfies Record<string, FieldOwnership>

export type PaymentFieldName = keyof typeof PAYMENT_FIELD_OWNERSHIP
export type PaymentFieldOwnership = typeof PAYMENT_FIELD_OWNERSHIP

/** Campos LWW (los únicos que pueden generar conflictos). */
export const LWW_PAYMENT_FIELDS = ['amount', 'paymentDate', 'memo'] as const
export type LwwPaymentField = (typeof LWW_PAYMENT_FIELDS)[number]
export const lwwPaymentFieldSchema = z.enum(LWW_PAYMENT_FIELDS)

/** Helper: indica si un campo dado es LWW (puede generar conflicto). */
export function isLwwField(field: string): field is LwwPaymentField {
  return (LWW_PAYMENT_FIELDS as readonly string[]).includes(field)
}

/** Helper: retorna el ownership de un campo, o `undefined` si no está en la matriz. */
export function getFieldOwnership(field: string): FieldOwnership | undefined {
  return (PAYMENT_FIELD_OWNERSHIP as Record<string, FieldOwnership>)[field]
}
