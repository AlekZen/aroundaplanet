import type { Timestamp } from 'firebase-admin/firestore'

// === Odoo raw record (what comes from XML-RPC) ===

export interface OdooTripRecord {
  id: number
  name: string
  list_price: number
  type: string
  categ_id: [number, string] | false
  active: boolean
  write_date: string
  create_date: string
  description_sale: string | false
  website_published: boolean
  image_1920: string | false
  sale_ok: boolean
  default_code: string | false
  currency_id: [number, string] | false
  rating_count: number
  rating_avg: number
}

export interface OdooEventRecord {
  id: number
  name: string
  date_begin: string
  date_end: string
  date_tz: string | false
  seats_max: number
  seats_available: number
  seats_used: number
  seats_reserved: number
  seats_taken: number
  active: boolean
  stage_id: [number, string] | false
  event_type_id: [number, string] | false
  event_ticket_ids: number[]
  write_date: string
  create_date: string
  website_published: boolean
}

// === Trip document attachment ===

export interface TripDocument {
  id: string
  name: string
  url: string
  type: string
  uploadedAt: string
}

// === Odoo document (synced from product.document / ir.attachment) ===

export interface OdooDocument {
  odooAttachmentId: number
  name: string
  mimetype: string
  fileSize: number
  shownOnProductPage: boolean
}

// === Firestore document: /trips/{tripId} ===

export interface Trip {
  // Odoo sync fields (overwritten by sync)
  odooProductId: number
  odooName: string
  odooListPriceCentavos: number
  odooCategory: string
  odooWriteDate: Timestamp
  odooCurrencyCode: string
  odooDescriptionSale: string
  odooRatingCount: number
  odooRatingAvg: number
  odooImageBase64: string | null
  odooDefaultCode: string | null
  odooSalesCount: number
  odooIsFavorite: boolean
  odooDocumentCount: number

  // Sync metadata
  lastSyncAt: Timestamp
  syncSource: 'manual' | 'scheduled'
  syncStatus: 'success' | 'error' | 'pending'

  // Status flags (sync can update)
  isActive: boolean
  isPublished: boolean
  isSaleOk: boolean

  // Departure aggregates (computed during sync from subcollection data, source: Odoo)
  nextDepartureDate: Timestamp | null
  nextDepartureEndDate: Timestamp | null
  totalDepartures: number
  totalSeatsMax: number
  totalSeatsAvailable: number

  // Editorial fields (NEVER overwritten by sync)
  heroImages: string[]
  slug: string
  emotionalCopy: string
  tags: string[]
  highlights: string[]
  difficulty: 'easy' | 'moderate' | 'challenging' | null
  seoTitle: string
  seoDescription: string
  documents: TripDocument[]
  odooDocuments: OdooDocument[]

  // Timestamps
  createdAt: Timestamp
  updatedAt: Timestamp
}

// === Firestore subcollection: /trips/{tripId}/departures/{departureId} ===

export interface TripDeparture {
  odooEventId: number | null
  odooName: string
  startDate: Timestamp
  endDate: Timestamp
  dateTimezone: string | null
  seatsMax: number
  seatsAvailable: number
  seatsUsed: number
  seatsReserved: number
  seatsTaken: number
  isActive: boolean
  isPublished: boolean
  syncSource: 'odoo' | 'manual'
  odooWriteDate: Timestamp | null
  lastSyncAt: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

// === Sync result ===

export interface TripSyncResult {
  total: number
  created: number
  updated: number
  skipped: number
  errors: number
  syncedAt: string
  syncSource: 'manual' | 'scheduled'
}

// === Sync options ===

export interface TripSyncOptions {
  mode: 'full' | 'incremental'
  nameFilter?: string
  minPrice?: number
}
