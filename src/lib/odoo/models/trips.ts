import { getOdooClient } from '@/lib/odoo/client'
import { mapOdooToTripFields, mapOdooToDepartureFields } from '@/schemas/tripSchema'
import type { OdooDomain } from '@/types/odoo'
import type { TripSyncOptions } from '@/types/trip'

const TRIP_FIELDS = [
  'name', 'list_price', 'type', 'categ_id', 'active', 'write_date', 'create_date',
  'description_sale', 'website_published', 'image_1920', 'sale_ok',
  'default_code', 'currency_id', 'rating_count', 'rating_avg',
] as const

const EVENT_FIELDS = [
  'name', 'date_begin', 'date_end', 'date_tz', 'seats_max', 'seats_available',
  'seats_used', 'seats_reserved', 'seats_taken', 'active', 'stage_id',
  'event_type_id', 'event_ticket_ids', 'write_date', 'create_date', 'website_published',
] as const

const BATCH_SIZE = 100

/**
 * Build Odoo domain filter for trip products.
 * Base: type='service', active=true, list_price >= minPrice
 * Optional: name filter (e.g., '2026')
 */
export function buildTripDomain(options: TripSyncOptions): OdooDomain {
  const domain: OdooDomain = [
    ['type', '=', 'service'],
    ['active', '=', true],
  ]

  const minPrice = options.minPrice ?? 5000
  domain.push(['list_price', '>=', minPrice])

  if (options.nameFilter) {
    domain.push(['name', 'ilike', options.nameFilter])
  }

  return domain
}

/**
 * Fetch trip products from Odoo with pagination.
 * Returns mapped Firestore-ready trip fields (odoo* only).
 */
export async function fetchTripsFromOdoo(options: TripSyncOptions) {
  const client = getOdooClient()
  const domain = buildTripDomain(options)

  const allIds = await client.search('product.template', domain, { limit: 10000 })
  const total = allIds.length

  const mappedTrips: NonNullable<ReturnType<typeof mapOdooToTripFields>>[] = []
  const errors: Array<{ odooId: number; error: string }> = []

  for (let offset = 0; offset < total; offset += BATCH_SIZE) {
    const batch = await client.searchRead(
      'product.template',
      domain,
      [...TRIP_FIELDS],
      { offset, limit: BATCH_SIZE, order: 'id asc' },
    )

    for (const record of batch) {
      const mapped = mapOdooToTripFields(record)
      if (mapped) {
        mappedTrips.push(mapped)
      } else {
        errors.push({ odooId: record.id, error: 'Zod validation failed' })
      }
    }
  }

  return { trips: mappedTrips, total, errors }
}

/**
 * Fetch events from Odoo for given product IDs (via event.event.ticket.product_id).
 * Currently returns empty array since Odoo has 0 events.
 * Structure ready for when Noel starts using Events module.
 */
export async function fetchDeparturesFromOdoo(odooProductIds: number[]) {
  if (odooProductIds.length === 0) return { departures: new Map(), errors: [] }

  const client = getOdooClient()
  const errors: Array<{ odooId: number; error: string }> = []

  // Map: odooProductId → departure fields[]
  const departuresByProduct = new Map<number, NonNullable<ReturnType<typeof mapOdooToDepartureFields>>[]>()

  // Step 1: Find product.product variants for these templates
  // event.event.ticket.product_id links to product.product (not product.template)
  // We need variant IDs + the reverse map (variant → template) in one query
  const variantToTemplate = new Map<number, number>()
  let productVariantIds: number[] = []
  try {
    const variants = await client.searchRead(
      'product.product',
      [['product_tmpl_id', 'in', odooProductIds]],
      ['id', 'product_tmpl_id'],
      { limit: 10000 },
    )
    for (const v of variants) {
      const tmplId = Array.isArray(v.product_tmpl_id)
        ? v.product_tmpl_id[0] as number
        : v.product_tmpl_id as number
      variantToTemplate.set(v.id, tmplId)
    }
    productVariantIds = variants.map(v => v.id)
  } catch {
    // If product.product query fails, return empty
    return { departures: departuresByProduct, errors }
  }

  if (productVariantIds.length === 0) {
    return { departures: departuresByProduct, errors }
  }

  // Step 2: Find tickets linked to those product variants
  let ticketEventMap: Map<number, number> // eventId → productTemplateId
  try {
    const tickets = await client.searchRead(
      'event.event.ticket',
      [['product_id', 'in', productVariantIds]],
      ['event_id', 'product_id'],
      { limit: 10000 },
    )

    if (tickets.length === 0) {
      return { departures: departuresByProduct, errors }
    }

    ticketEventMap = new Map()
    for (const ticket of tickets) {
      const eventId = Array.isArray(ticket.event_id)
        ? ticket.event_id[0] as number
        : ticket.event_id as number
      const productId = Array.isArray(ticket.product_id)
        ? ticket.product_id[0] as number
        : ticket.product_id as number
      const tmplId = variantToTemplate.get(productId)
      if (tmplId && eventId) {
        ticketEventMap.set(eventId, tmplId)
      }
    }
  } catch {
    return { departures: departuresByProduct, errors }
  }

  const eventIds = [...ticketEventMap.keys()]
  if (eventIds.length === 0) {
    return { departures: departuresByProduct, errors }
  }

  // Step 3: Fetch events (only future ones, 2025+)
  const events = await client.searchRead(
    'event.event',
    [
      ['id', 'in', eventIds],
      ['date_begin', '>=', '2025-01-01 00:00:00'],
    ],
    [...EVENT_FIELDS],
    { limit: 10000, order: 'date_begin asc' },
  )

  for (const event of events) {
    const mapped = mapOdooToDepartureFields(event)
    if (mapped) {
      const tmplId = ticketEventMap.get(event.id)
      if (tmplId) {
        const existing = departuresByProduct.get(tmplId) ?? []
        existing.push(mapped)
        departuresByProduct.set(tmplId, existing)
      }
    } else {
      errors.push({ odooId: event.id, error: 'Zod validation failed' })
    }
  }

  return { departures: departuresByProduct, errors }
}
