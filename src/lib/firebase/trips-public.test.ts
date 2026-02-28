import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockGet,
  mockDepGet,
  mockWhere,
  mockOrderBy,
  mockLimit,
  mockSelect,
  mockCollection,
  mockDoc,
  mockDepCollection,
  mockDepWhere,
  mockDepOrderBy,
} = vi.hoisted(() => {
  const mockGet = vi.fn()
  const mockDepGet = vi.fn()
  const mockSelect = vi.fn(() => ({ get: mockGet }))
  const mockLimit = vi.fn(() => ({ get: mockGet, select: mockSelect }))
  const mockOrderBy = vi.fn(() => ({ get: mockGet, select: mockSelect }))
  const mockWhere = vi.fn(() => ({
    where: vi.fn(() => ({
      limit: mockLimit,
      get: mockGet,
      orderBy: mockOrderBy,
      select: mockSelect,
    })),
    orderBy: mockOrderBy,
    get: mockGet,
    limit: mockLimit,
    select: mockSelect,
  }))

  // Departures subcollection chain
  const mockDepOrderBy = vi.fn(() => ({ get: mockDepGet }))
  const mockDepWhere = vi.fn(() => ({
    orderBy: mockDepOrderBy,
    where: vi.fn(() => ({ orderBy: mockDepOrderBy, get: mockDepGet })),
    get: mockDepGet,
  }))
  const mockDepCollection = vi.fn(() => ({ where: mockDepWhere }))
  const mockDoc = vi.fn(() => ({ collection: mockDepCollection }))

  const mockCollection = vi.fn((name: string) => {
    if (name === 'trips') {
      return { where: mockWhere, doc: mockDoc }
    }
    return { where: mockWhere }
  })

  return {
    mockGet,
    mockDepGet,
    mockWhere,
    mockOrderBy,
    mockLimit,
    mockSelect,
    mockCollection,
    mockDoc,
    mockDepCollection,
    mockDepWhere,
    mockDepOrderBy,
  }
})

vi.mock('server-only', () => ({}))
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: mockCollection },
}))

import {
  getPublishedTrips,
  getPublishedTripBySlug,
  getDeparturesForTrip,
} from './trips-public'

function makeTripDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      odooName: `Trip ${id}`,
      odooListPriceCentavos: 5000000,
      odooCurrencyCode: 'MXN',
      odooCategory: 'Europa',
      odooDescriptionSale: 'Test description',
      odooRatingAvg: 4.5,
      odooRatingCount: 12,
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

// Future date: 2027-06-15
const FUTURE_SECONDS = 1813363200
// Past date: 2024-01-15
const PAST_SECONDS = 1705276800

function makeDepartureDoc(
  id: string,
  overrides: Record<string, unknown> = {}
) {
  const defaults = {
    odooName: `Departure ${id}`,
    startDate: { _seconds: FUTURE_SECONDS, _nanoseconds: 0 },
    endDate: { _seconds: FUTURE_SECONDS + 86400 * 30, _nanoseconds: 0 },
    seatsMax: 20,
    seatsAvailable: 15,
    seatsUsed: 5,
    isActive: true,
    isPublished: true,
  }
  const merged = { ...defaults, ...overrides }
  return {
    id,
    data: () => merged,
  }
}

describe('trips-public', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset chainable mocks for trips
    mockSelect.mockImplementation(() => ({ get: mockGet }))
    mockWhere.mockImplementation(() => ({
      where: vi.fn(() => ({
        limit: mockLimit,
        get: mockGet,
        orderBy: mockOrderBy,
        select: mockSelect,
      })),
      orderBy: mockOrderBy,
      get: mockGet,
      limit: mockLimit,
      select: mockSelect,
    }))
    mockOrderBy.mockImplementation(() => ({ get: mockGet, select: mockSelect }))
    mockLimit.mockImplementation(() => ({ get: mockGet, select: mockSelect }))

    // Reset departures chain
    mockDepWhere.mockImplementation(() => ({
      orderBy: mockDepOrderBy,
      where: vi.fn(() => ({ orderBy: mockDepOrderBy, get: mockDepGet })),
      get: mockDepGet,
    }))
    mockDepOrderBy.mockImplementation(() => ({ get: mockDepGet }))
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
      expect(trips[0]).toEqual(
        expect.objectContaining({
          id: 't1',
          odooName: 'Trip t1',
          odooListPriceCentavos: 5000000,
          slug: 'trip-t1',
          isPublished: true,
          tags: ['adventure'],
          heroImages: ['/images/test.webp'],
        })
      )
    })

    it('returns empty array when no published trips', async () => {
      mockGet.mockResolvedValueOnce({ docs: [] })

      const trips = await getPublishedTrips()
      expect(trips).toEqual([])
    })

    it('normalizes missing editorial fields to defaults', async () => {
      mockGet.mockResolvedValueOnce({
        docs: [
          makeTripDoc('t1', {
            tags: undefined,
            highlights: undefined,
            heroImages: undefined,
            emotionalCopy: undefined,
            difficulty: undefined,
            nextDepartureDate: null,
            odooRatingAvg: undefined,
            odooRatingCount: undefined,
          }),
        ],
      })

      const trips = await getPublishedTrips()
      expect(trips[0].tags).toEqual([])
      expect(trips[0].highlights).toEqual([])
      expect(trips[0].heroImages).toEqual([])
      expect(trips[0].emotionalCopy).toBe('')
      expect(trips[0].difficulty).toBeNull()
      expect(trips[0].nextDepartureDate).toBeNull()
      expect(trips[0].odooRatingAvg).toBe(0)
      expect(trips[0].odooRatingCount).toBe(0)
    })

    it('includes odooRatingAvg and odooRatingCount in mapped trip', async () => {
      mockGet.mockResolvedValueOnce({
        docs: [makeTripDoc('t1', { odooRatingAvg: 4.8, odooRatingCount: 25 })],
      })

      const trips = await getPublishedTrips()
      expect(trips[0].odooRatingAvg).toBe(4.8)
      expect(trips[0].odooRatingCount).toBe(25)
    })

    it('handles Firestore Timestamp with _seconds format', async () => {
      mockGet.mockResolvedValueOnce({
        docs: [
          makeTripDoc('t1', {
            nextDepartureDate: { _seconds: 1772524800, _nanoseconds: 0 },
          }),
        ],
      })

      const trips = await getPublishedTrips()
      expect(trips[0].nextDepartureDate).toBe(
        new Date(1772524800 * 1000).toISOString()
      )
    })

    it('handles Firestore Timestamp with seconds format', async () => {
      mockGet.mockResolvedValueOnce({
        docs: [
          makeTripDoc('t1', {
            nextDepartureDate: { seconds: 1772524800, nanoseconds: 0 },
          }),
        ],
      })

      const trips = await getPublishedTrips()
      expect(trips[0].nextDepartureDate).toBe(
        new Date(1772524800 * 1000).toISOString()
      )
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

  describe('getDeparturesForTrip', () => {
    it('returns future published departures sorted by startDate', async () => {
      mockDepGet.mockResolvedValueOnce({
        docs: [
          makeDepartureDoc('d1'),
          makeDepartureDoc('d2', {
            odooName: 'Departure d2',
            startDate: { _seconds: FUTURE_SECONDS + 86400, _nanoseconds: 0 },
            seatsAvailable: 8,
          }),
        ],
      })

      const deps = await getDeparturesForTrip('trip1')

      expect(mockDoc).toHaveBeenCalledWith('trip1')
      expect(mockDepCollection).toHaveBeenCalledWith('departures')
      expect(mockDepWhere).toHaveBeenCalledWith('isActive', '==', true)
      expect(mockDepOrderBy).toHaveBeenCalledWith('startDate', 'asc')
      expect(deps).toHaveLength(2)
      expect(deps[0].id).toBe('d1')
      expect(deps[0].odooName).toBe('Departure d1')
      expect(deps[0].seatsAvailable).toBe(15)
      expect(deps[1].seatsAvailable).toBe(8)
    })

    it('returns empty array when no departures exist', async () => {
      mockDepGet.mockResolvedValueOnce({ docs: [] })

      const deps = await getDeparturesForTrip('trip1')
      expect(deps).toEqual([])
    })

    it('filters out past departures', async () => {
      mockDepGet.mockResolvedValueOnce({
        docs: [
          makeDepartureDoc('past', {
            startDate: { _seconds: PAST_SECONDS, _nanoseconds: 0 },
            isPublished: true,
          }),
          makeDepartureDoc('future', {
            startDate: { _seconds: FUTURE_SECONDS, _nanoseconds: 0 },
            isPublished: true,
          }),
        ],
      })

      const deps = await getDeparturesForTrip('trip1')
      expect(deps).toHaveLength(1)
      expect(deps[0].id).toBe('future')
    })

    it('filters out unpublished departures', async () => {
      mockDepGet.mockResolvedValueOnce({
        docs: [
          makeDepartureDoc('unpub', { isPublished: false }),
          makeDepartureDoc('pub', { isPublished: true }),
        ],
      })

      const deps = await getDeparturesForTrip('trip1')
      expect(deps).toHaveLength(1)
      expect(deps[0].id).toBe('pub')
    })

    it('serializes Timestamp fields to ISO strings', async () => {
      mockDepGet.mockResolvedValueOnce({
        docs: [
          makeDepartureDoc('d1', {
            startDate: { _seconds: FUTURE_SECONDS, _nanoseconds: 0 },
            endDate: { seconds: FUTURE_SECONDS + 86400, nanoseconds: 0 },
          }),
        ],
      })

      const deps = await getDeparturesForTrip('trip1')
      expect(deps[0].startDate).toBe(
        new Date(FUTURE_SECONDS * 1000).toISOString()
      )
      expect(deps[0].endDate).toBe(
        new Date((FUTURE_SECONDS + 86400) * 1000).toISOString()
      )
    })

    it('normalizes missing departure fields to defaults', async () => {
      mockDepGet.mockResolvedValueOnce({
        docs: [
          makeDepartureDoc('d1', {
            odooName: undefined,
            seatsMax: undefined,
            seatsAvailable: undefined,
            seatsUsed: undefined,
          }),
        ],
      })

      const deps = await getDeparturesForTrip('trip1')
      expect(deps[0].odooName).toBe('')
      expect(deps[0].seatsMax).toBe(0)
      expect(deps[0].seatsAvailable).toBe(0)
      expect(deps[0].seatsUsed).toBe(0)
    })

    it('handles both _seconds and seconds Timestamp formats', async () => {
      mockDepGet.mockResolvedValueOnce({
        docs: [
          makeDepartureDoc('d1', {
            startDate: { seconds: FUTURE_SECONDS, nanoseconds: 0 },
            endDate: { _seconds: FUTURE_SECONDS + 86400, _nanoseconds: 0 },
          }),
        ],
      })

      const deps = await getDeparturesForTrip('trip1')
      expect(deps[0].startDate).toBe(
        new Date(FUTURE_SECONDS * 1000).toISOString()
      )
    })
  })
})
