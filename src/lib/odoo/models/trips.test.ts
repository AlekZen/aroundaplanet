import { describe, it, expect, vi, beforeEach } from 'vitest'

// === Mocks ===

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

const mockSearchRead = vi.hoisted(() => vi.fn())
const mockSearch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/odoo/client', () => ({
  getOdooClient: vi.fn(() => ({
    searchRead: mockSearchRead,
    search: mockSearch,
    authenticate: vi.fn().mockResolvedValue(2),
  })),
}))

import { buildTripDomain, fetchTripsFromOdoo, fetchDeparturesFromOdoo } from './trips'
import type { TripSyncOptions } from '@/types/trip'

// === Fixtures ===

function makeOdooProduct(id: number, name: string, price: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name,
    list_price: price,
    type: 'service',
    categ_id: [1, 'All'],
    active: true,
    write_date: '2026-02-20 14:30:00',
    create_date: '2025-06-15 10:00:00',
    description_sale: `Descripcion de ${name}`,
    website_published: true,
    image_1920: 'base64data',
    sale_ok: true,
    default_code: `CODE-${id}`,
    currency_id: [33, 'MXN'],
    rating_count: 0,
    rating_avg: 0.0,
    ...overrides,
  }
}

// === Tests ===

describe('buildTripDomain', () => {
  it('builds base domain with default minPrice', () => {
    const options: TripSyncOptions = { mode: 'full' }
    const domain = buildTripDomain(options)

    expect(domain).toContainEqual(['type', '=', 'service'])
    expect(domain).toContainEqual(['active', '=', true])
    expect(domain).toContainEqual(['list_price', '>=', 5000])
  })

  it('applies custom minPrice', () => {
    const options: TripSyncOptions = { mode: 'full', minPrice: 10000 }
    const domain = buildTripDomain(options)

    expect(domain).toContainEqual(['list_price', '>=', 10000])
    expect(domain).not.toContainEqual(['list_price', '>=', 5000])
  })

  it('adds name filter when provided', () => {
    const options: TripSyncOptions = { mode: 'full', nameFilter: '2026' }
    const domain = buildTripDomain(options)

    expect(domain).toContainEqual(['name', 'ilike', '2026'])
  })

  it('does not add name filter when not provided', () => {
    const options: TripSyncOptions = { mode: 'full' }
    const domain = buildTripDomain(options)

    const nameFilters = domain.filter(
      d => Array.isArray(d) && d.length === 3 && d[0] === 'name'
    )
    expect(nameFilters).toHaveLength(0)
  })
})

describe('fetchTripsFromOdoo', () => {
  beforeEach(() => {
    mockSearchRead.mockReset()
    mockSearch.mockReset()
    mockTimestamp.now.mockClear()
    mockTimestamp.fromDate.mockClear()
  })

  it('fetches and maps trips from Odoo', async () => {
    const products = [
      makeOdooProduct(1015, 'VUELTA AL MUNDO 2025', 120000),
      makeOdooProduct(1748, 'VUELTA AL MUNDO 2026', 120000),
    ]

    mockSearch.mockResolvedValue([1015, 1748])
    mockSearchRead.mockResolvedValue(products)

    const result = await fetchTripsFromOdoo({ mode: 'full', nameFilter: '2026', minPrice: 5000 })

    expect(result.total).toBe(2)
    expect(result.trips).toHaveLength(2)
    expect(result.trips[0].odooProductId).toBe(1015)
    expect(result.trips[0].odooName).toBe('VUELTA AL MUNDO 2025')
    expect(result.trips[0].odooListPriceCentavos).toBe(12000000)
    expect(result.trips[1].odooProductId).toBe(1748)
    expect(result.errors).toHaveLength(0)
  })

  it('handles empty result from Odoo', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchRead.mockResolvedValue([])

    const result = await fetchTripsFromOdoo({ mode: 'full' })

    expect(result.total).toBe(0)
    expect(result.trips).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('reports validation errors for malformed records', async () => {
    const products = [
      makeOdooProduct(1015, 'VALID TRIP', 120000),
      { id: 9999, name: '' }, // invalid — empty name fails Zod
    ]

    mockSearch.mockResolvedValue([1015, 9999])
    mockSearchRead.mockResolvedValue(products)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await fetchTripsFromOdoo({ mode: 'full' })

    expect(result.trips).toHaveLength(1)
    expect(result.trips[0].odooProductId).toBe(1015)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].odooId).toBe(9999)
    consoleSpy.mockRestore()
  })

  it('paginates large result sets in batches of 100', async () => {
    // Simulate 150 IDs → 2 batches
    const ids = Array.from({ length: 150 }, (_, i) => i + 1)
    mockSearch.mockResolvedValue(ids)

    const batch1 = Array.from({ length: 100 }, (_, i) =>
      makeOdooProduct(i + 1, `TRIP ${i + 1}`, 10000)
    )
    const batch2 = Array.from({ length: 50 }, (_, i) =>
      makeOdooProduct(i + 101, `TRIP ${i + 101}`, 10000)
    )

    mockSearchRead
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)

    const result = await fetchTripsFromOdoo({ mode: 'full' })

    expect(result.total).toBe(150)
    expect(result.trips).toHaveLength(150)
    expect(mockSearchRead).toHaveBeenCalledTimes(2)

    // Verify pagination offsets
    const firstCall = mockSearchRead.mock.calls[0]
    expect(firstCall[3]).toMatchObject({ offset: 0, limit: 100 })
    const secondCall = mockSearchRead.mock.calls[1]
    expect(secondCall[3]).toMatchObject({ offset: 100, limit: 100 })
  })

  it('passes correct fields to searchRead', async () => {
    mockSearch.mockResolvedValue([1])
    mockSearchRead.mockResolvedValue([makeOdooProduct(1, 'TEST', 5000)])

    await fetchTripsFromOdoo({ mode: 'full' })

    const fields = mockSearchRead.mock.calls[0][2] as string[]
    expect(fields).toContain('name')
    expect(fields).toContain('list_price')
    expect(fields).toContain('image_1920')
    expect(fields).toContain('write_date')
    expect(fields).toContain('website_published')
    expect(fields).toContain('description_sale')
    expect(fields).toContain('currency_id')
  })
})

describe('fetchDeparturesFromOdoo', () => {
  beforeEach(() => {
    mockSearchRead.mockReset()
    mockSearch.mockReset()
  })

  it('returns empty map for empty product IDs', async () => {
    const result = await fetchDeparturesFromOdoo([])
    expect(result.departures.size).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('returns empty map when no product variants found', async () => {
    mockSearchRead.mockResolvedValueOnce([]) // product.product query returns empty

    const result = await fetchDeparturesFromOdoo([1015])
    expect(result.departures.size).toBe(0)
  })

  it('returns empty map when no tickets link events to products', async () => {
    // product.product variants found
    mockSearchRead.mockResolvedValueOnce([
      { id: 2001, product_tmpl_id: [1015, 'VUELTA AL MUNDO 2025'] },
    ])
    // event.event.ticket query returns empty
    mockSearchRead.mockResolvedValueOnce([])

    const result = await fetchDeparturesFromOdoo([1015])
    expect(result.departures.size).toBe(0)
  })

  it('handles errors in product.product query gracefully', async () => {
    mockSearchRead.mockRejectedValueOnce(new Error('Odoo error'))

    const result = await fetchDeparturesFromOdoo([1015])
    expect(result.departures.size).toBe(0)
    expect(result.errors).toHaveLength(0)
  })
})
