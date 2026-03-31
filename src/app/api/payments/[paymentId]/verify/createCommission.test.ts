import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSet = vi.fn()
const mockDocGet = vi.fn()
const mockAgentGet = vi.fn()

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    doc: (path: string) => {
      if (path.includes('/commissions/')) {
        return { get: mockDocGet, set: mockSet }
      }
      // agents/{agentId} doc
      return { get: mockAgentGet }
    },
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  },
}))

describe('createCommissionFromPayment', () => {
  beforeEach(() => {
    vi.resetModules()
    mockSet.mockReset()
    mockDocGet.mockReset()
    mockAgentGet.mockReset()
  })

  it('skips when payment has no agentId', async () => {
    const { createCommissionFromPayment } = await import('./createCommission')
    await createCommissionFromPayment('pay1', { amountCents: 50000 })
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('skips when amountCents is 0', async () => {
    const { createCommissionFromPayment } = await import('./createCommission')
    await createCommissionFromPayment('pay1', { agentId: 'agent1', amountCents: 0 })
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('skips when commission already exists (idempotency F3)', async () => {
    mockAgentGet.mockResolvedValue({ exists: true, data: () => ({ commissionRate: 0.10 }) })
    mockDocGet.mockResolvedValue({ exists: true })

    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    const { createCommissionFromPayment } = await import('./createCommission')
    await createCommissionFromPayment('pay1', {
      agentId: 'agent1',
      amountCents: 50000,
      date: '2026-03-15',
    })
    expect(mockSet).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('creates commission with default rate when agent doc has no commissionRate', async () => {
    mockAgentGet.mockResolvedValue({ exists: true, data: () => ({}) })
    mockDocGet.mockResolvedValue({ exists: false })
    mockSet.mockResolvedValue(undefined)

    const { createCommissionFromPayment } = await import('./createCommission')
    await createCommissionFromPayment('pay1', {
      agentId: 'agent1',
      amountCents: 100000,
      orderId: 'order1',
      clientName: 'Juan',
      tripName: 'Vuelta al Mundo',
      date: '2026-03-20',
    })

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'pay1',
        agentId: 'agent1',
        commissionRate: 0.10,
        commissionAmountCents: 10000,
        status: 'pending',
        period: '2026-03',
      })
    )
  })

  it('uses agent commissionRate when available', async () => {
    mockAgentGet.mockResolvedValue({ exists: true, data: () => ({ commissionRate: 0.15 }) })
    mockDocGet.mockResolvedValue({ exists: false })
    mockSet.mockResolvedValue(undefined)

    const { createCommissionFromPayment } = await import('./createCommission')
    await createCommissionFromPayment('pay1', {
      agentId: 'agent1',
      amountCents: 100000,
      date: '2026-04-01',
    })

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        commissionRate: 0.15,
        commissionAmountCents: 15000,
        period: '2026-04',
      })
    )
  })

  it('skips when commissionRate is invalid (>1)', async () => {
    mockAgentGet.mockResolvedValue({ exists: true, data: () => ({ commissionRate: 1.5 }) })

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { createCommissionFromPayment } = await import('./createCommission')
    await createCommissionFromPayment('pay1', {
      agentId: 'agent1',
      amountCents: 50000,
    })

    expect(mockSet).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
