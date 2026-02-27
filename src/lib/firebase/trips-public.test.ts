import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGet, mockWhere, mockOrderBy, mockLimit, mockSelect, mockCollection } = vi.hoisted(() => {
  const mockGet = vi.fn()
  const mockSelect = vi.fn(() => ({ get: mockGet }))
  const mockLimit = vi.fn(() => ({ get: mockGet, select: mockSelect }))
  const mockOrderBy = vi.fn(() => ({ get: mockGet, select: mockSelect }))
  const mockWhere = vi.fn(() => ({ where: vi.fn(() => ({ limit: mockLimit, get: mockGet, orderBy: mockOrderBy, select: mockSelect })), orderBy: mockOrderBy, get: mockGet, limit: mockLimit, select: mockSelect }))
  const mockCollection = vi.fn(() => ({ where: mockWhere }))
  return { mockGet, mockWhere, mockOrderBy, mockLimit, mockSelect, mockCollection }
})

vi.mock('server-only', () => ({}))
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: mockCollection },
}))

import { getPublishedTrips, getPublishedTripBySlug } from './trips-public'

function makeTripDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      odooName: `Trip ${id}`,
      odooListPriceCentavos: 5000000,
      odooCurrencyCode: 'MXN',
      odooCategory: 'Europa',
      odooDescriptionSale: 'Test description',
      slug: `trip-${id}`,
      emotionalCopy: '',
      tags: ['adventure'],
      highlights: ['highlight1'],
      difficulty: 'moderate',
      seoTitle: `Trip ${id} SEO`,
      seoDescription: 'SEO desc',
      heroImages: ['/images/test.webp'],
      isPublished: true,
      nextDepartureDate: { _seconds: 1772524800, _nanoseconds: 0 }, // 2026-03-01
      totalDepartures: 3,
      totalSeatsAvailable: 10,
      totalSeatsMax: 20,
      ...overrides,
    }),
  }
}

describe('trips-public', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset chainable mock
    mockSelect.mockImplementation(() => ({ get: mockGet }))
    mockWhere.mockImplementation(() => ({
      where: vi.fn(() => ({ limit: mockLimit, get: mockGet, orderBy: mockOrderBy, select: mockSelect })),
      orderBy: mockOrderBy,
      get: mockGet,
      limit: mockLimit,
      select: mockSelect,
    }))
    mockOrderBy.mockImplementation(() => ({ get: mockGet, select: mockSelect }))
    mockLimit.mockImplementation(() => ({ get: mockGet, select: mockSelect }))
  })

  describe('getPublishedTrips', () => {
    it('returns published trips mapped to PublicTrip', async () => {
      mockGet.mockResolvedValueOnce({
        docs: [makeTripDoc('t1'), makeTripDoc('t2')],
      })

      const trips = await getPublishedTrips()

      expect(mockCollection).toHaveBeenCalledWith('trips')
      expect(mockWhere).toHaveBeenCalledWith('isPublished', '==', true)
      expect(trips).toHaveLength(2)
      expect(trips[0]).toEqual(expect.objectContaining({
        id: 't1',
        odooName: 'Trip t1',
        odooListPriceCentavos: 5000000,
        slug: 'trip-t1',
        isPublished: true,
        tags: ['adventure'],
        heroImages: ['/images/test.webp'],
      }))
    })

    it('returns empty array when no published trips', async () => {
      mockGet.mockResolvedValueOnce({ docs: [] })

      const trips = await getPublishedTrips()
      expect(trips).toEqual([])
    })

    it('normalizes missing editorial fields to defaults', async () => {
      mockGet.mockResolvedValueOnce({
        docs: [makeTripDoc('t1', {
          tags: undefined,
          highlights: undefined,
          heroImages: undefined,
          emotionalCopy: undefined,
          difficulty: undefined,
          nextDepartureDate: null,
        })],
      })

      const trips = await getPublishedTrips()
      expect(trips[0].tags).toEqual([])
      expect(trips[0].highlights).toEqual([])
      expect(trips[0].heroImages).toEqual([])
      expect(trips[0].emotionalCopy).toBe('')
      expect(trips[0].difficulty).toBeNull()
      expect(trips[0].nextDepartureDate).toBeNull()
    })

    it('handles Firestore Timestamp with _seconds format', async () => {
      mockGet.mockResolvedValueOnce({
        docs: [makeTripDoc('t1', { nextDepartureDate: { _seconds: 1772524800, _nanoseconds: 0 } })],
      })

      const trips = await getPublishedTrips()
      expect(trips[0].nextDepartureDate).toBe(new Date(1772524800 * 1000).toISOString())
    })

    it('handles Firestore Timestamp with seconds format', async () => {
      mockGet.mockResolvedValueOnce({
        docs: [makeTripDoc('t1', { nextDepartureDate: { seconds: 1772524800, nanoseconds: 0 } })],
      })

      const trips = await getPublishedTrips()
      expect(trips[0].nextDepartureDate).toBe(new Date(1772524800 * 1000).toISOString())
    })
  })

  describe('getPublishedTripBySlug', () => {
    it('returns trip when found by slug', async () => {
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [makeTripDoc('t1')],
      })

      const trip = await getPublishedTripBySlug('trip-t1')
      expect(trip).not.toBeNull()
      expect(trip?.id).toBe('t1')
      expect(trip?.slug).toBe('trip-t1')
    })

    it('returns null when slug not found', async () => {
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] })

      const trip = await getPublishedTripBySlug('nonexistent')
      expect(trip).toBeNull()
    })
  })
})
