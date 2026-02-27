import { z } from 'zod'
import { Timestamp } from 'firebase-admin/firestore'
import { odooAmountToCentavos, odooDateToTimestamp } from '@/schemas/odooSchema'
import type { Trip, TripDeparture } from '@/types/trip'

// === Odoo raw record validation ===

export const odooTripRecordSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  list_price: z.number(),
  type: z.string(),
  categ_id: z.union([z.tuple([z.number(), z.string()]), z.literal(false)]),
  active: z.boolean(),
  write_date: z.string(),
  create_date: z.string(),
  description_sale: z.union([z.string(), z.literal(false)]),
  website_published: z.boolean(),
  image_1920: z.union([z.string(), z.literal(false)]),
  sale_ok: z.boolean(),
  default_code: z.union([z.string(), z.literal(false)]),
  currency_id: z.union([z.tuple([z.number(), z.string()]), z.literal(false)]),
  rating_count: z.number().int(),
  rating_avg: z.number(),
  sales_count: z.number(),
  is_favorite: z.boolean(),
  product_document_count: z.number().int(),
})

export const odooEventRecordSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  date_begin: z.string(),
  date_end: z.string(),
  date_tz: z.union([z.string(), z.literal(false)]),
  seats_max: z.number().int(),
  seats_available: z.number().int(),
  seats_used: z.number().int(),
  seats_reserved: z.number().int(),
  seats_taken: z.number().int(),
  active: z.boolean(),
  stage_id: z.union([z.tuple([z.number(), z.string()]), z.literal(false)]),
  event_type_id: z.union([z.tuple([z.number(), z.string()]), z.literal(false)]),
  event_ticket_ids: z.array(z.number()),
  write_date: z.string(),
  create_date: z.string(),
  website_published: z.boolean(),
})

// === Sync options validation ===

export const tripSyncOptionsSchema = z.object({
  mode: z.enum(['full', 'incremental']).default('incremental'),
  nameFilter: z.string().optional(),
  minPrice: z.number().min(0).optional(),
})

// === Mapping: Odoo record → Firestore Trip (odoo* fields only) ===

export function mapOdooToTripFields(record: Record<string, unknown>): Omit<Trip,
  'heroImages' | 'slug' | 'emotionalCopy' | 'tags' | 'highlights' |
  'difficulty' | 'seoTitle' | 'seoDescription' | 'documents' | 'odooDocuments' |
  'nextDepartureDate' | 'nextDepartureEndDate' | 'totalDepartures' | 'totalSeatsMax' | 'totalSeatsAvailable' |
  'createdAt' | 'updatedAt'
> | null {
  const parsed = odooTripRecordSchema.safeParse(record)
  if (!parsed.success) {
    console.error(`[tripSchema] Zod validation failed for product ${String(record.id)}:`, parsed.error.issues)
    return null
  }

  const data = parsed.data
  const writeDate = odooDateToTimestamp(data.write_date)
  const now = Timestamp.now()

  return {
    odooProductId: data.id,
    odooName: data.name.trim(),
    odooListPriceCentavos: odooAmountToCentavos(data.list_price),
    odooCategory: Array.isArray(data.categ_id) ? data.categ_id[1] : '',
    odooWriteDate: writeDate ?? now,
    odooCurrencyCode: Array.isArray(data.currency_id) ? data.currency_id[1] : 'MXN',
    odooDescriptionSale: typeof data.description_sale === 'string' ? data.description_sale : '',
    odooRatingCount: data.rating_count,
    odooRatingAvg: data.rating_avg,
    odooImageBase64: typeof data.image_1920 === 'string' && data.image_1920.length > 0
      ? data.image_1920
      : null,
    odooDefaultCode: typeof data.default_code === 'string' ? data.default_code : null,
    odooSalesCount: data.sales_count,
    odooIsFavorite: data.is_favorite,
    odooDocumentCount: data.product_document_count,

    lastSyncAt: now,
    syncSource: 'manual' as const,
    syncStatus: 'success' as const,

    isActive: data.active,
    isPublished: data.website_published,
    isSaleOk: data.sale_ok,
  }
}

// === Mapping: Odoo event → Firestore TripDeparture ===

export function mapOdooToDepartureFields(record: Record<string, unknown>): Omit<TripDeparture,
  'createdAt' | 'updatedAt'
> | null {
  const parsed = odooEventRecordSchema.safeParse(record)
  if (!parsed.success) {
    console.error(`[tripSchema] Zod validation failed for event ${String(record.id)}:`, parsed.error.issues)
    return null
  }

  const data = parsed.data
  const startDate = odooDateToTimestamp(data.date_begin)
  const endDate = odooDateToTimestamp(data.date_end)
  const writeDate = odooDateToTimestamp(data.write_date)
  const now = Timestamp.now()

  if (!startDate || !endDate) {
    console.error(`[tripSchema] Invalid dates for event ${String(data.id)}: begin=${data.date_begin}, end=${data.date_end}`)
    return null
  }

  return {
    odooEventId: data.id,
    odooName: data.name.trim(),
    startDate,
    endDate,
    dateTimezone: typeof data.date_tz === 'string' ? data.date_tz : null,
    seatsMax: data.seats_max,
    seatsAvailable: data.seats_available,
    seatsUsed: data.seats_used,
    seatsReserved: data.seats_reserved,
    seatsTaken: data.seats_taken,
    isActive: data.active,
    isPublished: data.website_published,
    syncSource: 'odoo' as const,
    odooWriteDate: writeDate ?? now,
    lastSyncAt: now,
  }
}

// === Trip document ID from Odoo product ID ===

export function tripDocId(odooProductId: number): string {
  return `odoo-${odooProductId}`
}

// === Departure document ID from Odoo event ID ===

export function departureDocId(odooEventId: number): string {
  return `odoo-${odooEventId}`
}

// === Editorial update validation (PATCH /api/trips/[tripId]) ===

const DIFFICULTY_VALUES = ['easy', 'moderate', 'challenging'] as const

export const tripEditorialUpdateSchema = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug debe ser kebab-case').optional(),
  emotionalCopy: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  highlights: z.array(z.string().min(1).max(200)).max(10).optional(),
  difficulty: z.enum(DIFFICULTY_VALUES).nullable().optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  isPublished: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, {
  message: 'Se requiere al menos un campo para actualizar',
})

// === Departure creation (POST /api/trips/[tripId]/departures) ===

export const tripDepartureCreateSchema = z.object({
  name: z.string().min(1).max(200),
  startDate: z.string().datetime({ message: 'startDate debe ser ISO 8601' }),
  endDate: z.string().datetime({ message: 'endDate debe ser ISO 8601' }),
  seatsMax: z.number().int().min(1).max(1000),
}).refine((data) => new Date(data.endDate) > new Date(data.startDate), {
  message: 'endDate debe ser posterior a startDate',
  path: ['endDate'],
})

// === Departure update (PATCH /api/trips/[tripId]/departures/[departureId]) ===

export const tripDepartureUpdateSchema = z.object({
  seatsMax: z.number().int().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
}).strict()

// === Trip list query (GET /api/trips) ===

export const tripListQuerySchema = z.object({
  search: z.string().max(100).optional(),
  filter: z.enum(['all', 'published', 'draft', 'with-departures']).default('all'),
  cursor: z.string().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// === Slug generation helper (re-export from client-safe module) ===

export { generateSlug } from '@/lib/utils/slugify'
