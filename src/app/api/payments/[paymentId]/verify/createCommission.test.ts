import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTxSet = vi.fn()
const mockTxGet = vi.fn()
const mockAgentGet = vi.fn()

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    doc: (path: string) => {
      if (path.includes('/commissions/')) {
        return { id: path.split('/').pop() }
      }
      // agents/{agentId} doc
      return { get: mockAgentGet }
    },
    runTransaction: async (fn: (tx: { get: typeof mockTxGet; set: typeof mockTxSet }) => Promise<void>) => {
      await fn({ get: mockTxGet, set: mockTxSet })
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
    mockTxSet.mockReset()
    mockTxGet.mockReset()
    mockAgentGet.mockReset()
  })

  it('skips when payment has no agentId', async () => {
    const { createCommissionFromPayment } = await import('./createCommission')
    await createCommissionFromPayment('pay1', { amountCents: 50000 })
    expect(mockTxSet).not.toHaveBeenCalled()
  })

  it('skips when agentId is not a string', async () => {
    const { createCommissionFromPayment } = await import('./createCommission')
    await createCommissionFromPayment('pay1', { agentId: 123, amountCents: 50000 })
    expect(mockTxSet).not.toHaveBeenCalled()
  })

  it('skips when amountCents is not a number', async () => {
    const { createCommissionFromPayment } = await import('./createCommission')
    await createCommissionFromPayment('pay1', { agentId: 'agent1', amountCents: '50000' })
    expect(mockTxSet).not.toHaveBeenCalled()
  })

  it('skips when amountCents is 0', async () => {
    const { createCommissionFromPayment } = await import('./createCommission')
    await createCommissionFromPayment('pay1', { agentId: 'agent1', amountCents: 0 })
    expect(mockTxSet).not.toHaveBeenCalled()
  })

  it('skips when commission already exists (idempotency via transaction)', async () => {
    mockAgentGet.mockResolvedValue({ exists: true, data: () => ({ commissionRate: 0.10 }) })
    mockTxGet.mockResolvedValue({ exists: true })

    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    const { createCommissionFromPayment } = await import('./createCommission')
    await createCommissionFromPayment('pay1', {
      agentId: 'agent1',
      amountCents: 50000,
      date: '2026-03-15',
    })
    expect(mockTxSet).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('creates commission with default rate when agent doc has no commissionRate', async () => {
    mockAgentGet.mockResolvedValue({ exists: true, data: () => ({}) })
    mockTxGet.mockResolvedValue({ exists: false })

    const { createCommissionFromPayment } = await import('./createCommission')
    await createCommissionFromPayment('pay1', {
      agentId: 'agent1',
      amountCents: 100000,
      orderId: 'order1',
      clientName: 'Juan',
      tripName: 'Vuelta al Mundo',
      date: '2026-03-20',
    })

    expect(mockTxSet).toHaveBeenCalledWith(
      expect.anything(),
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
    mockTxGet.mockResolvedValue({ exists: false })

    const { createCommissionFromPayment } = await import('./createCommission')
    await createCommissionFromPayment('pay1', {
      agentId: 'agent1',
      amountCents: 100000,
      date: '2026-04-01',
    })

    expect(mockTxSet).toHaveBeenCalledWith(
      expect.anything(),
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

    expect(mockTxSet).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
