import { describe, it, expect, vi, beforeEach } from 'vitest'

// === Hoisted mocks ===

const { mockCollection, mockDoc, mockWhere, mockOrderBy, mockGet, mockUpdate } = vi.hoisted(() => {
  const mockUpdate = vi.fn()
  const mockGet = vi.fn()
  const mockOrderBy = vi.fn()
  const mockWhere = vi.fn()
  const mockDoc = vi.fn()
  const mockCollection = vi.fn()
  return { mockCollection, mockDoc, mockWhere, mockOrderBy, mockGet, mockUpdate }
})

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: mockCollection,
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    now: vi.fn(() => ({ _seconds: Math.floor(Date.now() / 1000) })),
    fromDate: vi.fn((d: Date) => ({ _seconds: Math.floor(d.getTime() / 1000) })),
  },
  FieldValue: {
    serverTimestamp: vi.fn(() => ({})),
  },
}))

import { recalculateTripAggregates } from './departure-aggregates'

// === Helpers ===

function makeDepartureDoc(data: Record<string, unknown>) {
  return {
    data: () => data,
  }
}

function setupChain(docs: ReturnType<typeof makeDepartureDoc>[]) {
  const tripDocRef = {
    collection: vi.fn().mockReturnValue({
      where: mockWhere,
    }),
    update: mockUpdate,
  }

  mockWhere.mockReturnValue({ orderBy: mockOrderBy })
  mockOrderBy.mockReturnValue({ get: mockGet })
  mockGet.mockResolvedValue({ docs })

  mockDoc.mockReturnValue(tripDocRef)
  mockCollection.mockReturnValue({ doc: mockDoc })

  return tripDocRef
}

// === Tests ===

describe('recalculateTripAggregates', () => {
  beforeEach(() => {
    mockCollection.mockReset()
    mockDoc.mockReset()
    mockWhere.mockReset()
    mockOrderBy.mockReset()
    mockGet.mockReset()
    mockUpdate.mockReset()
  })

  it('calculates aggregates from future active+published departures', async () => {
    const futureDate = Math.floor(Date.now() / 1000) + 86400 * 30 // 30 days from now
    const futureEndDate = futureDate + 86400 * 33

    setupChain([
      makeDepartureDoc({
        isPublished: true,
        startDate: { _seconds: futureDate },
        endDate: { _seconds: futureEndDate },
        seatsMax: 30,
        seatsAvailable: 12,
      }),
      makeDepartureDoc({
        isPublished: true,
        startDate: { _seconds: futureDate + 86400 * 60 },
        endDate: { _seconds: futureDate + 86400 * 93 },
        seatsMax: 25,
        seatsAvailable: 25,
      }),
    ])

    await recalculateTripAggregates('trip-1')

    expect(mockUpdate).toHaveBeenCalledWith({
      totalDepartures: 2,
      nextDepartureDate: { _seconds: futureDate },
      nextDepartureEndDate: { _seconds: futureEndDate },
      totalSeatsMax: 55,
      totalSeatsAvailable: 37,
    })
  })

  it('excludes unpublished departures from aggregates', async () => {
    const futureDate = Math.floor(Date.now() / 1000) + 86400 * 30

    setupChain([
      makeDepartureDoc({
        isPublished: false,
        startDate: { _seconds: futureDate },
        endDate: { _seconds: futureDate + 86400 * 33 },
        seatsMax: 30,
        seatsAvailable: 30,
      }),
    ])

    await recalculateTripAggregates('trip-1')

    expect(mockUpdate).toHaveBeenCalledWith({
      totalDepartures: 0,
      nextDepartureDate: null,
      nextDepartureEndDate: null,
      totalSeatsMax: 0,
      totalSeatsAvailable: 0,
    })
  })

  it('excludes past departures from aggregates', async () => {
    const pastDate = Math.floor(Date.now() / 1000) - 86400 * 30 // 30 days ago

    setupChain([
      makeDepartureDoc({
        isPublished: true,
        startDate: { _seconds: pastDate },
        endDate: { _seconds: pastDate + 86400 * 33 },
        seatsMax: 30,
        seatsAvailable: 30,
      }),
    ])

    await recalculateTripAggregates('trip-1')

    expect(mockUpdate).toHaveBeenCalledWith({
      totalDepartures: 0,
      nextDepartureDate: null,
      nextDepartureEndDate: null,
      totalSeatsMax: 0,
      totalSeatsAvailable: 0,
    })
  })

  it('sets null dates when no departures exist', async () => {
    setupChain([])

    await recalculateTripAggregates('trip-1')

    expect(mockUpdate).toHaveBeenCalledWith({
      totalDepartures: 0,
      nextDepartureDate: null,
      nextDepartureEndDate: null,
      totalSeatsMax: 0,
      totalSeatsAvailable: 0,
    })
  })

  it('uses first future departure for nextDepartureDate (sorted by startDate ASC)', async () => {
    const nearFuture = Math.floor(Date.now() / 1000) + 86400 * 10
    const farFuture = Math.floor(Date.now() / 1000) + 86400 * 60

    setupChain([
      makeDepartureDoc({
        isPublished: true,
        startDate: { _seconds: nearFuture },
        endDate: { _seconds: nearFuture + 86400 * 33 },
        seatsMax: 20,
        seatsAvailable: 5,
      }),
      makeDepartureDoc({
        isPublished: true,
        startDate: { _seconds: farFuture },
        endDate: { _seconds: farFuture + 86400 * 33 },
        seatsMax: 30,
        seatsAvailable: 30,
      }),
    ])

    await recalculateTripAggregates('trip-1')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        nextDepartureDate: { _seconds: nearFuture },
      })
    )
  })
})
