import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock firebase-admin before importing schemas
const mockTimestamp = vi.hoisted(() => {
  const createTimestamp = (seconds: number) => ({
    _seconds: seconds,
    _nanoseconds: 0,
    toDate: () => new Date(seconds * 1000),
    toMillis: () => seconds * 1000,
  })
  return {
    now: vi.fn(() => createTimestamp(Math.floor(Date.now() / 1000))),
    fromDate: vi.fn((date: Date) => createTimestamp(Math.floor(date.getTime() / 1000))),
  }
})

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: mockTimestamp,
  FieldValue: { serverTimestamp: vi.fn(() => ({})) },
  getFirestore: vi.fn(),
}))

import {
  odooTripRecordSchema,
  odooEventRecordSchema,
  tripSyncOptionsSchema,
  tripEditorialUpdateSchema,
  tripDepartureCreateSchema,
  tripDepartureUpdateSchema,
  tripListQuerySchema,
  generateSlug,
  mapOdooToTripFields,
  mapOdooToDepartureFields,
  tripDocId,
  departureDocId,
} from './tripSchema'

// === Test data fixtures ===

function makeOdooTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: 1015,
    name: 'VUELTA AL MUNDO 2025',
    list_price: 120000,
    type: 'service',
    categ_id: [1, 'All'],
    active: true,
    write_date: '2026-02-20 14:30:00',
    create_date: '2025-06-15 10:00:00',
    description_sale: 'Viaje completo alrededor del mundo en 33.8 dias',
    website_published: true,
    image_1920: 'iVBORw0KGgoAAAANSUhEUg==',
    sale_ok: true,
    default_code: 'VDM-2025',
    currency_id: [33, 'MXN'],
    rating_count: 0,
    rating_avg: 0.0,
    sales_count: 3,
    is_favorite: true,
    product_document_count: 5,
    ...overrides,
  }
}

function makeOdooEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    name: 'VUELTA AL MUNDO - Salida Marzo 2026',
    date_begin: '2026-03-15 08:00:00',
    date_end: '2026-04-18 20:00:00',
    date_tz: 'America/Mexico_City',
    seats_max: 30,
    seats_available: 12,
    seats_used: 18,
    seats_reserved: 5,
    seats_taken: 23,
    active: true,
    stage_id: [1, 'New'],
    event_type_id: [1, 'VUELTA AL MUNDO 2024'],
    event_ticket_ids: [101, 102],
    write_date: '2026-02-25 09:00:00',
    create_date: '2026-01-10 12:00:00',
    website_published: true,
    ...overrides,
  }
}

// === Tests ===

describe('odooTripRecordSchema', () => {
  it('validates a correct Odoo trip record', () => {
    const result = odooTripRecordSchema.safeParse(makeOdooTrip())
    expect(result.success).toBe(true)
  })

  it('validates record with false values (Odoo returns false for empty fields)', () => {
    const result = odooTripRecordSchema.safeParse(makeOdooTrip({
      categ_id: false,
      description_sale: false,
      image_1920: false,
      default_code: false,
      currency_id: false,
    }))
    expect(result.success).toBe(true)
  })

  it('rejects record with missing id', () => {
    const data = makeOdooTrip()
    delete (data as Record<string, unknown>).id
    const result = odooTripRecordSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects record with empty name', () => {
    const result = odooTripRecordSchema.safeParse(makeOdooTrip({ name: '' }))
    expect(result.success).toBe(false)
  })

  it('rejects record with negative id', () => {
    const result = odooTripRecordSchema.safeParse(makeOdooTrip({ id: -1 }))
    expect(result.success).toBe(false)
  })

  it('rejects record with non-number list_price', () => {
    const result = odooTripRecordSchema.safeParse(makeOdooTrip({ list_price: 'free' }))
    expect(result.success).toBe(false)
  })

  it('accepts record with zero list_price', () => {
    const result = odooTripRecordSchema.safeParse(makeOdooTrip({ list_price: 0 }))
    expect(result.success).toBe(true)
  })
})

describe('odooEventRecordSchema', () => {
  it('validates a correct Odoo event record', () => {
    const result = odooEventRecordSchema.safeParse(makeOdooEvent())
    expect(result.success).toBe(true)
  })

  it('validates event with false optional fields', () => {
    const result = odooEventRecordSchema.safeParse(makeOdooEvent({
      date_tz: false,
      stage_id: false,
      event_type_id: false,
    }))
    expect(result.success).toBe(true)
  })

  it('validates event with empty ticket_ids', () => {
    const result = odooEventRecordSchema.safeParse(makeOdooEvent({ event_ticket_ids: [] }))
    expect(result.success).toBe(true)
  })

  it('rejects event with missing date_begin', () => {
    const data = makeOdooEvent()
    delete (data as Record<string, unknown>).date_begin
    const result = odooEventRecordSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('tripSyncOptionsSchema', () => {
  it('validates full sync options', () => {
    const result = tripSyncOptionsSchema.safeParse({ mode: 'full' })
    expect(result.success).toBe(true)
    expect(result.data?.mode).toBe('full')
  })

  it('validates incremental sync with filters', () => {
    const result = tripSyncOptionsSchema.safeParse({
      mode: 'incremental',
      nameFilter: '2026',
      minPrice: 5000,
    })
    expect(result.success).toBe(true)
    expect(result.data?.nameFilter).toBe('2026')
    expect(result.data?.minPrice).toBe(5000)
  })

  it('defaults mode to incremental', () => {
    const result = tripSyncOptionsSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data?.mode).toBe('incremental')
  })

  it('rejects invalid mode', () => {
    const result = tripSyncOptionsSchema.safeParse({ mode: 'partial' })
    expect(result.success).toBe(false)
  })

  it('rejects negative minPrice', () => {
    const result = tripSyncOptionsSchema.safeParse({ mode: 'full', minPrice: -100 })
    expect(result.success).toBe(false)
  })
})

describe('mapOdooToTripFields', () => {
  beforeEach(() => {
    mockTimestamp.now.mockClear()
    mockTimestamp.fromDate.mockClear()
  })

  it('maps a valid Odoo record to Firestore trip fields', () => {
    const result = mapOdooToTripFields(makeOdooTrip())
    expect(result).not.toBeNull()
    expect(result!.odooProductId).toBe(1015)
    expect(result!.odooName).toBe('VUELTA AL MUNDO 2025')
    expect(result!.odooListPriceCentavos).toBe(12000000) // $120,000 * 100
    expect(result!.odooCategory).toBe('All')
    expect(result!.odooCurrencyCode).toBe('MXN')
    expect(result!.odooDescriptionSale).toBe('Viaje completo alrededor del mundo en 33.8 dias')
    expect(result!.odooRatingCount).toBe(0)
    expect(result!.odooRatingAvg).toBe(0.0)
    expect(result!.odooImageBase64).toBe('iVBORw0KGgoAAAANSUhEUg==')
    expect(result!.odooDefaultCode).toBe('VDM-2025')
    expect(result!.odooSalesCount).toBe(3)
    expect(result!.odooIsFavorite).toBe(true)
    expect(result!.odooDocumentCount).toBe(5)
    expect(result!.isActive).toBe(true)
    expect(result!.isPublished).toBe(true)
    expect(result!.isSaleOk).toBe(true)
    expect(result!.syncSource).toBe('manual')
    expect(result!.syncStatus).toBe('success')
  })

  it('converts price to centavos correctly', () => {
    const result = mapOdooToTripFields(makeOdooTrip({ list_price: 44900 }))
    expect(result!.odooListPriceCentavos).toBe(4490000) // $44,900 * 100
  })

  it('handles false fields from Odoo gracefully', () => {
    const result = mapOdooToTripFields(makeOdooTrip({
      categ_id: false,
      description_sale: false,
      image_1920: false,
      default_code: false,
      currency_id: false,
    }))
    expect(result).not.toBeNull()
    expect(result!.odooCategory).toBe('')
    expect(result!.odooDescriptionSale).toBe('')
    expect(result!.odooImageBase64).toBeNull()
    expect(result!.odooDefaultCode).toBeNull()
    expect(result!.odooCurrencyCode).toBe('MXN')
  })

  it('trims whitespace from name', () => {
    const result = mapOdooToTripFields(makeOdooTrip({ name: '  EUROPA SEPTIEMBRE 2025  ' }))
    expect(result!.odooName).toBe('EUROPA SEPTIEMBRE 2025')
  })

  it('returns null for invalid record', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = mapOdooToTripFields({ id: 'invalid' } as never)
    expect(result).toBeNull()
    consoleSpy.mockRestore()
  })

  it('returns null for record missing required fields', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = mapOdooToTripFields({ id: 1, name: 'Test' } as never)
    expect(result).toBeNull()
    consoleSpy.mockRestore()
  })

  it('handles empty image_1920 string as null', () => {
    const result = mapOdooToTripFields(makeOdooTrip({ image_1920: '' }))
    expect(result!.odooImageBase64).toBeNull()
  })

  it('calls odooDateToTimestamp for write_date', () => {
    mapOdooToTripFields(makeOdooTrip())
    expect(mockTimestamp.fromDate).toHaveBeenCalled()
  })
})

describe('mapOdooToDepartureFields', () => {
  beforeEach(() => {
    mockTimestamp.now.mockClear()
    mockTimestamp.fromDate.mockClear()
  })

  it('maps a valid Odoo event to departure fields', () => {
    const result = mapOdooToDepartureFields(makeOdooEvent())
    expect(result).not.toBeNull()
    expect(result!.odooEventId).toBe(42)
    expect(result!.odooName).toBe('VUELTA AL MUNDO - Salida Marzo 2026')
    expect(result!.seatsMax).toBe(30)
    expect(result!.seatsAvailable).toBe(12)
    expect(result!.seatsUsed).toBe(18)
    expect(result!.seatsReserved).toBe(5)
    expect(result!.seatsTaken).toBe(23)
    expect(result!.dateTimezone).toBe('America/Mexico_City')
    expect(result!.isActive).toBe(true)
    expect(result!.isPublished).toBe(true)
  })

  it('handles false date_tz', () => {
    const result = mapOdooToDepartureFields(makeOdooEvent({ date_tz: false }))
    expect(result).not.toBeNull()
    expect(result!.dateTimezone).toBeNull()
  })

  it('returns null for invalid event record', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = mapOdooToDepartureFields({ id: 'bad' } as never)
    expect(result).toBeNull()
    consoleSpy.mockRestore()
  })

  it('returns null for event with invalid dates', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockTimestamp.fromDate.mockReturnValueOnce(null as unknown as ReturnType<typeof mockTimestamp.fromDate>)
    const result = mapOdooToDepartureFields(makeOdooEvent({ date_begin: 'not-a-date' }))
    expect(result).toBeNull()
    consoleSpy.mockRestore()
  })
})

describe('tripDocId', () => {
  it('generates consistent document ID from Odoo product ID', () => {
    expect(tripDocId(1015)).toBe('odoo-1015')
    expect(tripDocId(1748)).toBe('odoo-1748')
  })
})

describe('departureDocId', () => {
  it('generates consistent document ID from Odoo event ID', () => {
    expect(departureDocId(42)).toBe('odoo-42')
    expect(departureDocId(100)).toBe('odoo-100')
  })
})

// === Editorial schemas tests ===

describe('tripEditorialUpdateSchema', () => {
  it('accepts valid editorial update with all fields', () => {
    const result = tripEditorialUpdateSchema.safeParse({
      slug: 'vuelta-al-mundo-2026',
      emotionalCopy: 'El viaje de tu vida',
      tags: ['aventura', 'premium'],
      highlights: ['33 dias', '15 paises'],
      difficulty: 'moderate',
      seoTitle: 'Vuelta al Mundo 2026',
      seoDescription: 'Viaje alrededor del mundo en 33.8 dias',
      isPublished: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts partial update (single field)', () => {
    const result = tripEditorialUpdateSchema.safeParse({ slug: 'new-slug' })
    expect(result.success).toBe(true)
  })

  it('rejects empty object (requires at least one field)', () => {
    const result = tripEditorialUpdateSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts null difficulty', () => {
    const result = tripEditorialUpdateSchema.safeParse({ difficulty: null })
    expect(result.success).toBe(true)
    expect(result.data?.difficulty).toBeNull()
  })

  it('rejects invalid slug format (must be kebab-case)', () => {
    expect(tripEditorialUpdateSchema.safeParse({ slug: 'Has Spaces' }).success).toBe(false)
    expect(tripEditorialUpdateSchema.safeParse({ slug: 'UPPERCASE' }).success).toBe(false)
    expect(tripEditorialUpdateSchema.safeParse({ slug: 'special_chars!' }).success).toBe(false)
    expect(tripEditorialUpdateSchema.safeParse({ slug: '' }).success).toBe(false)
  })

  it('rejects invalid difficulty value', () => {
    const result = tripEditorialUpdateSchema.safeParse({ difficulty: 'extreme' })
    expect(result.success).toBe(false)
  })

  it('rejects seoTitle over 70 chars', () => {
    const result = tripEditorialUpdateSchema.safeParse({ seoTitle: 'x'.repeat(71) })
    expect(result.success).toBe(false)
  })

  it('rejects seoDescription over 160 chars', () => {
    const result = tripEditorialUpdateSchema.safeParse({ seoDescription: 'x'.repeat(161) })
    expect(result.success).toBe(false)
  })

  it('rejects unknown fields (strict mode)', () => {
    const result = tripEditorialUpdateSchema.safeParse({ odooName: 'hack' })
    expect(result.success).toBe(false)
  })

  it('rejects tags with empty strings', () => {
    const result = tripEditorialUpdateSchema.safeParse({ tags: ['valid', ''] })
    expect(result.success).toBe(false)
  })

  it('rejects more than 20 tags', () => {
    const result = tripEditorialUpdateSchema.safeParse({ tags: Array(21).fill('tag') })
    expect(result.success).toBe(false)
  })
})

describe('tripDepartureCreateSchema', () => {
  const validDeparture = {
    name: 'Salida Marzo 2026',
    startDate: '2026-03-15T08:00:00.000Z',
    endDate: '2026-04-18T20:00:00.000Z',
    seatsMax: 30,
  }

  it('accepts valid departure', () => {
    const result = tripDepartureCreateSchema.safeParse(validDeparture)
    expect(result.success).toBe(true)
  })

  it('defaults isPublished to false when omitted', () => {
    const result = tripDepartureCreateSchema.safeParse(validDeparture)
    expect(result.success).toBe(true)
    expect(result.data?.isPublished).toBe(false)
  })

  it('accepts isPublished true', () => {
    const result = tripDepartureCreateSchema.safeParse({ ...validDeparture, isPublished: true })
    expect(result.success).toBe(true)
    expect(result.data?.isPublished).toBe(true)
  })

  it('accepts isPublished false explicitly', () => {
    const result = tripDepartureCreateSchema.safeParse({ ...validDeparture, isPublished: false })
    expect(result.success).toBe(true)
    expect(result.data?.isPublished).toBe(false)
  })

  it('rejects missing name', () => {
    const { name: _, ...noName } = validDeparture
    const result = tripDepartureCreateSchema.safeParse(noName)
    expect(result.success).toBe(false)
  })

  it('rejects non-ISO startDate', () => {
    const result = tripDepartureCreateSchema.safeParse({
      ...validDeparture,
      startDate: '2026-03-15',
    })
    expect(result.success).toBe(false)
  })

  it('rejects endDate before startDate', () => {
    const result = tripDepartureCreateSchema.safeParse({
      ...validDeparture,
      startDate: '2026-04-18T20:00:00.000Z',
      endDate: '2026-03-15T08:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects seatsMax of 0', () => {
    const result = tripDepartureCreateSchema.safeParse({
      ...validDeparture,
      seatsMax: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects seatsMax over 1000', () => {
    const result = tripDepartureCreateSchema.safeParse({
      ...validDeparture,
      seatsMax: 1001,
    })
    expect(result.success).toBe(false)
  })
})

describe('tripDepartureUpdateSchema', () => {
  it('accepts partial update with seatsMax', () => {
    const result = tripDepartureUpdateSchema.safeParse({ seatsMax: 50 })
    expect(result.success).toBe(true)
  })

  it('accepts partial update with isActive', () => {
    const result = tripDepartureUpdateSchema.safeParse({ isActive: false })
    expect(result.success).toBe(true)
  })

  it('accepts partial update with isPublished', () => {
    const result = tripDepartureUpdateSchema.safeParse({ isPublished: true })
    expect(result.success).toBe(true)
  })

  it('accepts isPublished combined with isActive', () => {
    const result = tripDepartureUpdateSchema.safeParse({ isPublished: true, isActive: false })
    expect(result.success).toBe(true)
  })

  it('accepts empty object', () => {
    const result = tripDepartureUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects unknown fields (strict mode)', () => {
    const result = tripDepartureUpdateSchema.safeParse({ startDate: '2026-01-01' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid seatsMax', () => {
    expect(tripDepartureUpdateSchema.safeParse({ seatsMax: 0 }).success).toBe(false)
    expect(tripDepartureUpdateSchema.safeParse({ seatsMax: -1 }).success).toBe(false)
  })
})

describe('tripListQuerySchema', () => {
  it('accepts empty query (uses defaults)', () => {
    const result = tripListQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data?.filter).toBe('all')
    expect(result.data?.pageSize).toBe(20)
  })

  it('accepts all valid filters', () => {
    for (const filter of ['all', 'published', 'draft', 'with-departures']) {
      const result = tripListQuerySchema.safeParse({ filter })
      expect(result.success).toBe(true)
    }
  })

  it('accepts search with cursor', () => {
    const result = tripListQuerySchema.safeParse({
      search: 'vuelta',
      cursor: 'odoo-1015',
      pageSize: 10,
    })
    expect(result.success).toBe(true)
    expect(result.data?.search).toBe('vuelta')
    expect(result.data?.cursor).toBe('odoo-1015')
    expect(result.data?.pageSize).toBe(10)
  })

  it('coerces string pageSize to number', () => {
    const result = tripListQuerySchema.safeParse({ pageSize: '50' })
    expect(result.success).toBe(true)
    expect(result.data?.pageSize).toBe(50)
  })

  it('rejects invalid filter', () => {
    const result = tripListQuerySchema.safeParse({ filter: 'archived' })
    expect(result.success).toBe(false)
  })

  it('rejects pageSize over 100', () => {
    const result = tripListQuerySchema.safeParse({ pageSize: 101 })
    expect(result.success).toBe(false)
  })

  it('rejects search over 100 chars', () => {
    const result = tripListQuerySchema.safeParse({ search: 'x'.repeat(101) })
    expect(result.success).toBe(false)
  })
})

describe('generateSlug', () => {
  it('converts name to kebab-case', () => {
    expect(generateSlug('VUELTA AL MUNDO 2026')).toBe('vuelta-al-mundo-2026')
  })

  it('removes diacritics', () => {
    expect(generateSlug('Excursion Especial')).toBe('excursion-especial')
  })

  it('removes special characters', () => {
    expect(generateSlug('Trip #1: "Best Ever!"')).toBe('trip-1-best-ever')
  })

  it('collapses multiple spaces and hyphens', () => {
    expect(generateSlug('trip   ---  name')).toBe('trip-name')
  })

  it('trims whitespace', () => {
    expect(generateSlug('  padded name  ')).toBe('padded-name')
  })
})
