import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCollection, mockBatch } = vi.hoisted(() => {
  const mockBatch = {
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  }
  const mockCollection = vi.fn()
  return { mockCollection, mockBatch }
})

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: mockCollection,
    batch: () => mockBatch,
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => ({})),
  },
}))

import { linkGuestOrders } from './linkGuestOrders'

describe('linkGuestOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 0 and does no query when guestToken is null', async () => {
    const result = await linkGuestOrders('user-1', null)
    expect(result).toBe(0)
    expect(mockCollection).not.toHaveBeenCalled()
  })

  it('returns 0 when no matching orders found', async () => {
    const mockGet = vi.fn().mockResolvedValue({ empty: true, docs: [], size: 0 })
    const mockLimit = vi.fn().mockReturnValue({ get: mockGet })
    const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 })
    mockCollection.mockReturnValue({ where: mockWhere1 })

    const result = await linkGuestOrders('user-1', 'token-abc')
    expect(result).toBe(0)
    expect(mockBatch.update).not.toHaveBeenCalled()
  })

  it('links matching orders and returns count', async () => {
    const mockRef1 = { id: 'order-1' }
    const mockRef2 = { id: 'order-2' }
    const mockGet = vi.fn().mockResolvedValue({
      empty: false,
      docs: [{ ref: mockRef1 }, { ref: mockRef2 }],
      size: 2,
    })
    const mockLimit = vi.fn().mockReturnValue({ get: mockGet })
    const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 })
    mockCollection.mockReturnValue({ where: mockWhere1 })

    const result = await linkGuestOrders('user-1', 'token-abc')

    expect(result).toBe(2)
    expect(mockBatch.update).toHaveBeenCalledTimes(2)
    expect(mockBatch.update).toHaveBeenCalledWith(mockRef1, expect.objectContaining({
      userId: 'user-1',
      guestToken: null,
    }))
    expect(mockBatch.commit).toHaveBeenCalled()
  })

  it('is idempotent — re-running returns 0 after orders are linked', async () => {
    // First call finds and links
    const mockGet1 = vi.fn().mockResolvedValue({
      empty: false,
      docs: [{ ref: { id: 'order-1' } }],
      size: 1,
    })
    const mockLimit1 = vi.fn().mockReturnValue({ get: mockGet1 })
    const mockWhere2a = vi.fn().mockReturnValue({ limit: mockLimit1 })
    const mockWhere1a = vi.fn().mockReturnValue({ where: mockWhere2a })
    mockCollection.mockReturnValue({ where: mockWhere1a })

    const first = await linkGuestOrders('user-1', 'token-abc')
    expect(first).toBe(1)

    // Second call finds nothing (userId is no longer null)
    vi.clearAllMocks()
    const mockGet2 = vi.fn().mockResolvedValue({ empty: true, docs: [], size: 0 })
    const mockLimit2 = vi.fn().mockReturnValue({ get: mockGet2 })
    const mockWhere2b = vi.fn().mockReturnValue({ limit: mockLimit2 })
    const mockWhere1b = vi.fn().mockReturnValue({ where: mockWhere2b })
    mockCollection.mockReturnValue({ where: mockWhere1b })

    const second = await linkGuestOrders('user-1', 'token-abc')
    expect(second).toBe(0)
  })
})
