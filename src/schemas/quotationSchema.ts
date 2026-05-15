import { z } from 'zod'
import { TIPOS_VIAJE, RANGOS_PRESUPUESTO } from './cotizacionSchema'

/**
 * Story 10.1 — Cotizaciones persistidas.
 * Source `cotizar-public` se crea desde el form público `/cotizar` ANTES de abrir WhatsApp.
 * El PDF (`@react-pdf/renderer`) se genera después desde admin si el cliente convierte.
 */
export const QUOTATION_STATUSES = ['lead', 'pdf-generated', 'sent', 'closed'] as const
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number]
export const quotationStatusSchema = z.enum(QUOTATION_STATUSES)

export const quotationSourceSchema = z.enum(['cotizar-public', 'admin-manual'])

export const quotationLeadSnapshotSchema = z.object({
  nombreAgente: z.string().trim().min(2).max(200).nullable().optional(),
  nombreCliente: z.string().trim().min(2).max(200),
  contactPhone: z.string().trim().max(40).nullable().optional(),
  contactEmail: z.string().trim().email().max(200).nullable().optional(),
  tipoViaje: z.enum(TIPOS_VIAJE),
  destino: z.string().trim().min(2).max(200),
  fechaSalida: z.string().trim().min(1).max(40),
  fechaRegreso: z.string().trim().min(1).max(40),
  adultos: z.string().trim().min(1).max(10),
  menores: z.string().trim().min(1).max(10),
  edadesMenores: z.string().trim().max(200).optional().default(''),
  habitaciones: z.string().trim().min(1).max(10),
  presupuesto: z.enum(RANGOS_PRESUPUESTO),
  notas: z.string().trim().max(500).optional().default(''),
})

export type QuotationLeadSnapshot = z.infer<typeof quotationLeadSnapshotSchema>

/** Payload del cliente para POST /api/quotations (público) */
export const createQuotationSchema = z.object({
  source: quotationSourceSchema,
  leadSnapshot: quotationLeadSnapshotSchema,
  whatsappSent: z.boolean().default(false),
})

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>

/** Shape persistido en Firestore `quotations/{quotationId}` */
export const quotationDocumentSchema = z.object({
  quotationId: z.string().min(1),
  source: quotationSourceSchema,
  leadSnapshot: quotationLeadSnapshotSchema,
  status: quotationStatusSchema,
  pdfUrl: z.string().url().nullable(),
  pdfStoragePath: z.string().nullable(),
  pdfVersion: z.number().int().min(0),
  whatsappSent: z.boolean(),
  createdBy: z.string().nullable(),
})

export type QuotationDocument = z.infer<typeof quotationDocumentSchema>
