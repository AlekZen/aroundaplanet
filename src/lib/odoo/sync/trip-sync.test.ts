import { describe, it, expect, vi, beforeEach } from 'vitest'

// === Hoisted mocks ===

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

const mockSet = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockAdd = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'audit-1' }))
const mockDocData = vi.hoisted(() => vi.fn())

const mockGetDocs = vi.hoisted(() => vi.fn())

const mockDocRef = vi.hoisted(() => ({
  set: mockSet,
  data: mockDocData,
  ref: { set: mockSet },
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({ set: mockSet })),
  })),
}))

const mockWhereRef = vi.hoisted(() => ({
  get: mockGetDocs,
}))

const mockCollectionRef = vi.hoisted(() => ({
  doc: vi.fn(() => mockDocRef),
  get: mockGetDocs,
  add: mockAdd,
  where: vi.fn(() => mockWhereRef),
}))

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: mockTimestamp,
  FieldValue: { serverTimestamp: vi.fn(() => ({})) },
  getFirestore: vi.fn(),
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === 'auditLog') return { add: mockAdd }
      return mockCollectionRef
    }),
  },
}))

const mockFetchTrips = vi.hoisted(() => vi.fn())
const mockFetchDepartures = vi.hoisted(() => vi.fn())

vi.mock('@/lib/odoo/models/trips', () => ({
  fetchTripsFromOdoo: mockFetchTrips,
  fetchDeparturesFromOdoo: mockFetchDepartures,
}))

import { syncTrips } from './trip-sync'

// === Helpers ===

function makeTripFields(odooId: number, name: string, overrides: Record<string, unknown> = {}) {
  return {
    odooProductId: odooId,
    odooName: name,
    odooListPriceCentavos: 12000000,
    odooCategory: 'All',
    odooWriteDate: mockTimestamp.fromDate(new Date('2026-02-25T10:00:00Z')),
    odooCurrencyCode: 'MXN',
    odooDescriptionSale: `Desc ${name}`,
    odooRatingCount: 0,
    odooRatingAvg: 0,
    odooImageBase64: null,
    odooDefaultCode: null,
    lastSyncAt: mockTimestamp.now(),
    syncSource: 'manual',
    syncStatus: 'success',
    isActive: true,
    isPublished: true,
    isSaleOk: true,
    ...overrides,
  }
}

function setupEmptyFirestore() {
  mockGetDocs.mockResolvedValue({ docs: [] })
}

function setupExistingTrips(trips: Array<{ odooProductId: number; odooWriteDate: unknown; isActive: boolean }>) {
  const docs = trips.map(t => ({
    id: `odoo-${t.odooProductId}`,
    exists: true,
    data: () => ({
      odooProductId: t.odooProductId,
      odooWriteDate: t.odooWriteDate,
      isActive: t.isActive,
    }),
    ref: { set: mockSet },
  }))
  mockGetDocs.mockResolvedValue({ docs })
}

// === Tests ===

describe('syncTrips', () => {
  beforeEach(() => {
    mockSet.mockReset().mockResolvedValue(undefined)
    mockAdd.mockReset().mockResolvedValue({ id: 'audit-1' })
    mockGetDocs.mockReset()
    mockFetchTrips.mockReset()
    mockFetchDepartures.mockReset().mockResolvedValue({ departures: new Map(), errors: [] })
    mockTimestamp.now.mockClear()
    mockTimestamp.fromDate.mockClear()
    mockCollectionRef.doc.mockClear().mockReturnValue(mockDocRef)
  })

  it('creates new trip documents when Firestore is empty', async () => {
    setupEmptyFirestore()

    const tripFields = [
      makeTripFields(1015, 'VUELTA AL MUNDO 2025'),
      makeTripFields(1748, 'VUELTA AL MUNDO 2026'),
    ]
    mockFetchTrips.mockResolvedValue({ trips: tripFields, total: 2, errors: [] })

    const result = await syncTrips({ mode: 'full', nameFilter: '2026', minPrice: 5000 }, 'user-123')

    expect(result.created).toBe(2)
    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toBe(0)
    expect(result.total).toBe(2)
    expect(result.syncSource).toBe('manual')
    expect(mockSet).toHaveBeenCalledTimes(2)
  })

  it('updates existing trip documents preserving editorial fields', async () => {
    const existingWriteDate = mockTimestamp.fromDate(new Date('2026-02-20T10:00:00Z'))
    setupExistingTrips([
      { odooProductId: 1015, odooWriteDate: existingWriteDate, isActive: true },
    ])

    const newTripFields = makeTripFields(1015, 'VUELTA AL MUNDO 2025 UPDATED')
    mockFetchTrips.mockResolvedValue({ trips: [newTripFields], total: 1, errors: [] })

    const result = await syncTrips({ mode: 'full' }, 'user-123')

    expect(result.updated).toBe(1)
    expect(result.created).toBe(0)

    // Verify set was called with { merge: true } — preserves editorial fields
    const setCalls = mockSet.mock.calls
    const updateCall = setCalls.find(
      (call: unknown[]) => call.length === 2 && (call[1] as { merge?: boolean })?.merge === true
    )
    expect(updateCall).toBeDefined()
  })

  it('skips unchanged trips in incremental mode', async () => {
    const writeDate = mockTimestamp.fromDate(new Date('2026-02-25T10:00:00Z'))
    setupExistingTrips([
      { odooProductId: 1015, odooWriteDate: writeDate, isActive: true },
    ])

    // Same write_date as existing
    const tripFields = makeTripFields(1015, 'VUELTA AL MUNDO 2025', {
      odooWriteDate: writeDate,
    })
    mockFetchTrips.mockResolvedValue({ trips: [tripFields], total: 1, errors: [] })

    const result = await syncTrips({ mode: 'incremental' }, 'user-123')

    expect(result.skipped).toBe(1)
    expect(result.updated).toBe(0)
    expect(result.created).toBe(0)
  })

  it('soft deletes trips not in Odoo results during full sync', async () => {
    setupExistingTrips([
      { odooProductId: 1015, odooWriteDate: mockTimestamp.now(), isActive: true },
      { odooProductId: 9999, odooWriteDate: mockTimestamp.now(), isActive: true }, // not in Odoo results
    ])

    const tripFields = makeTripFields(1015, 'VUELTA AL MUNDO 2025')
    mockFetchTrips.mockResolvedValue({ trips: [tripFields], total: 1, errors: [] })

    const result = await syncTrips({ mode: 'full' }, 'user-123')

    // 1 updated (1015) + 1 soft deleted (9999) = 2 updated
    expect(result.updated).toBe(2)

    // Verify soft delete call sets isActive: false
    const softDeleteCall = mockSet.mock.calls.find(
      (call: unknown[]) => {
        const data = call[0] as Record<string, unknown>
        return data?.isActive === false
      }
    )
    expect(softDeleteCall).toBeDefined()
  })

  it('does NOT soft delete in incremental mode', async () => {
    setupExistingTrips([
      { odooProductId: 1015, odooWriteDate: mockTimestamp.fromDate(new Date('2026-02-20T10:00:00Z')), isActive: true },
      { odooProductId: 9999, odooWriteDate: mockTimestamp.now(), isActive: true },
    ])

    const newWriteDate = mockTimestamp.fromDate(new Date('2026-02-26T10:00:00Z'))
    const tripFields = makeTripFields(1015, 'VUELTA AL MUNDO 2025', {
      odooWriteDate: newWriteDate,
    })
    mockFetchTrips.mockResolvedValue({ trips: [tripFields], total: 1, errors: [] })

    await syncTrips({ mode: 'incremental' }, 'user-123')

    // Should NOT soft delete 9999
    const softDeleteCall = mockSet.mock.calls.find(
      (call: unknown[]) => {
        const data = call[0] as Record<string, unknown>
        return data?.isActive === false
      }
    )
    expect(softDeleteCall).toBeUndefined()
  })

  it('handles empty Odoo results gracefully', async () => {
    setupEmptyFirestore()
    mockFetchTrips.mockResolvedValue({ trips: [], total: 0, errors: [] })

    const result = await syncTrips({ mode: 'full' }, 'user-123')

    expect(result.total).toBe(0)
    expect(result.created).toBe(0)
    expect(result.updated).toBe(0)
    expect(result.errors).toBe(0)
  })

  it('counts fetch errors in result', async () => {
    setupEmptyFirestore()
    mockFetchTrips.mockResolvedValue({
      trips: [makeTripFields(1015, 'TRIP')],
      total: 2,
      errors: [{ odooId: 9999, error: 'Zod validation failed' }],
    })

    const result = await syncTrips({ mode: 'full' }, 'user-123')

    expect(result.errors).toBe(1)
    expect(result.created).toBe(1)
  })

  it('writes audit log entry', async () => {
    setupEmptyFirestore()
    mockFetchTrips.mockResolvedValue({ trips: [], total: 0, errors: [] })

    await syncTrips({ mode: 'full', nameFilter: '2026', minPrice: 5000 }, 'user-123')

    expect(mockAdd).toHaveBeenCalledTimes(1)
    const auditEntry = mockAdd.mock.calls[0][0]
    expect(auditEntry.action).toBe('odoo.tripSyncCompleted')
    expect(auditEntry.performedBy).toBe('user-123')
    expect(auditEntry.details.mode).toBe('full')
    expect(auditEntry.details.nameFilter).toBe('2026')
    expect(auditEntry.details.minPrice).toBe(5000)
  })

  it('returns correct syncSource based on mode', async () => {
    setupEmptyFirestore()
    mockFetchTrips.mockResolvedValue({ trips: [], total: 0, errors: [] })

    const fullResult = await syncTrips({ mode: 'full' }, 'user-123')
    expect(fullResult.syncSource).toBe('manual')

    const incResult = await syncTrips({ mode: 'incremental' }, 'user-123')
    expect(incResult.syncSource).toBe('scheduled')
  })

  it('continues syncing trips even if departures fetch fails', async () => {
    setupEmptyFirestore()

    const tripFields = [makeTripFields(1015, 'VUELTA AL MUNDO 2025')]
    mockFetchTrips.mockResolvedValue({ trips: tripFields, total: 1, errors: [] })
    mockFetchDepartures.mockRejectedValue(new Error('Events module error'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await syncTrips({ mode: 'full' }, 'user-123')

    expect(result.created).toBe(1)
    expect(result.total).toBe(1)
    consoleSpy.mockRestore()
  })

  it('handles Firestore write errors per-document without stopping', async () => {
    setupEmptyFirestore()

    const tripFields = [
      makeTripFields(1015, 'TRIP 1'),
      makeTripFields(1748, 'TRIP 2'),
    ]
    mockFetchTrips.mockResolvedValue({ trips: tripFields, total: 2, errors: [] })

    // First set call fails, second succeeds
    mockSet
      .mockRejectedValueOnce(new Error('Firestore write error'))
      .mockResolvedValueOnce(undefined)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await syncTrips({ mode: 'full' }, 'user-123')

    expect(result.errors).toBe(1)
    expect(result.created).toBe(1)
    consoleSpy.mockRestore()
  })

  it('does not skip already-inactive docs during soft delete', async () => {
    setupExistingTrips([
      { odooProductId: 9999, odooWriteDate: mockTimestamp.now(), isActive: false }, // already inactive
    ])

    mockFetchTrips.mockResolvedValue({ trips: [], total: 0, errors: [] })

    const result = await syncTrips({ mode: 'full' }, 'user-123')

    // Should NOT re-set isActive=false on already-inactive doc
    const softDeleteCall = mockSet.mock.calls.find(
      (call: unknown[]) => {
        const data = call[0] as Record<string, unknown>
        return data?.isActive === false
      }
    )
    expect(softDeleteCall).toBeUndefined()
    expect(result.updated).toBe(0)
  })
})
