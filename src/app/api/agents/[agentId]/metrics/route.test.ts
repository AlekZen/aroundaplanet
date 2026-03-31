import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Hoisted mocks ---
const {
  mockRequireAuth,
  mockAuthorizeAgent,
  mockPaymentsGet,
  mockOrdersGet,
  mockPendingCommissionsGet,
  mockEarnedCommissionsGet,
  mockFromDate,
} = vi.hoisted(() => {
  const mockRequireAuth = vi.fn()
  const mockAuthorizeAgent = vi.fn()
  const mockPaymentsGet = vi.fn()
  const mockOrdersGet = vi.fn()
  const mockPendingCommissionsGet = vi.fn()
  const mockEarnedCommissionsGet = vi.fn()
  const mockFromDate = vi.fn()
  return {
    mockRequireAuth,
    mockAuthorizeAgent,
    mockPaymentsGet,
    mockOrdersGet,
    mockPendingCommissionsGet,
    mockEarnedCommissionsGet,
    mockFromDate,
  }
})

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: mockRequireAuth,
}))

vi.mock('@/lib/auth/authorizeAgent', () => ({
  authorizeAgent: mockAuthorizeAgent,
}))

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    fromDate: mockFromDate,
  },
}))

vi.mock('@/lib/firebase/admin', () => {
  // payments chain: .where().where().where().get()
  const paymentsChain = {
    where: () => paymentsChain,
    get: () => mockPaymentsGet(),
  }

  // orders chain: .where().where().limit().get()
  const ordersChain = {
    where: () => ordersChain,
    limit: () => ordersChain,
    get: () => mockOrdersGet(),
  }

  // commissions chain (collectionGroup): .where().where().get()
  // Distinguished by which mock to call via a counter strategy —
  // first call is pending, second call is earned.
  let commissionsCallCount = 0
  const commissionsChain = {
    where: () => commissionsChain,
    get: () => {
      commissionsCallCount += 1
      if (commissionsCallCount % 2 === 1) {
        return mockPendingCommissionsGet()
      }
      return mockEarnedCommissionsGet()
    },
  }

  // Reset counter when mock is re-used across tests via clearAllMocks
  // by attaching reset function (called in beforeEach via mockAuthorizeAgent.mockReset chain)
  ;(commissionsChain as unknown as { _resetCallCount: () => void })._resetCallCount = () => {
    commissionsCallCount = 0
  }

  return {
    adminDb: {
      collection: (name: string) => {
        if (name === 'payments') return paymentsChain
        if (name === 'orders') return ordersChain
        return {}
      },
      collectionGroup: (_name: string) => commissionsChain,
    },
  }
})

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: vi.fn((error: unknown) => {
    if (error && typeof error === 'object' && 'status' in error) {
      const e = error as { status: number; code: string; message: string; retryable: boolean }
      return Response.json({ code: e.code, message: e.message, retryable: e.retryable }, { status: e.status })
    }
    return Response.json({ code: 'INTERNAL_ERROR', message: 'Error interno', retryable: true }, { status: 500 })
  }),
}))

import { GET } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/agents/agent1/metrics')
}

function makeContext(agentId = 'agent1') {
  return { params: Promise.resolve({ agentId }) }
}

describe('GET /api/agents/[agentId]/metrics', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset the commissions call counter embedded in the mock
    const { adminDb } = await import('@/lib/firebase/admin')
    const commissionsGroup = adminDb.collectionGroup('commissions') as unknown as {
      _resetCallCount: () => void
    }
    if (typeof commissionsGroup._resetCallCount === 'function') {
      commissionsGroup._resetCallCount()
    }

    mockRequireAuth.mockResolvedValue({ uid: 'u1', roles: ['agente'], agentId: 'agent1' })
    mockAuthorizeAgent.mockReturnValue(undefined)
    mockFromDate.mockReturnValue({ seconds: 1700000000, nanoseconds: 0 })

    // Default: empty snapshots
    mockPaymentsGet.mockResolvedValue({ docs: [] })
    mockOrdersGet.mockResolvedValue({ docs: [] })
    mockPendingCommissionsGet.mockResolvedValue({ docs: [] })
    mockEarnedCommissionsGet.mockResolvedValue({ docs: [] })
  })

  it('returns correct metrics with data', async () => {
    mockPaymentsGet.mockResolvedValue({
      docs: [
        { data: () => ({ amountCents: 14500000 }) },
        { data: () => ({ amountCents: 14500000 }) },
      ],
    })

    mockOrdersGet.mockResolvedValue({
      docs: [
        { id: 'o1', data: () => ({ userId: 'user-a', contactName: 'Ana' }) },
        { id: 'o2', data: () => ({ userId: 'user-b', contactName: 'Bruno' }) },
        { id: 'o3', data: () => ({ userId: 'user-a', contactName: 'Ana' }) }, // duplicate userId
      ],
    })

    mockPendingCommissionsGet.mockResolvedValue({
      docs: [{ data: () => ({ commissionAmountCents: 1450000 }) }],
    })

    mockEarnedCommissionsGet.mockResolvedValue({
      docs: [
        { data: () => ({ commissionAmountCents: 2900000 }) },
        { data: () => ({ commissionAmountCents: 1450000 }) },
      ],
    })

    const res = await GET(makeRequest(), makeContext())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.verifiedSalesCents).toBe(29000000)
    expect(body.activeClients).toBe(2)
    expect(body.pendingCommissionsCents).toBe(1450000)
    expect(body.earnedCommissionsCents).toBe(4350000)
  })

  it('returns zeros when no data', async () => {
    const res = await GET(makeRequest(), makeContext())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.verifiedSalesCents).toBe(0)
    expect(body.activeClients).toBe(0)
    expect(body.pendingCommissionsCents).toBe(0)
    expect(body.earnedCommissionsCents).toBe(0)
  })

  it('enforces agent isolation', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockAuthorizeAgent.mockImplementation(() => {
      throw new AppError('AGENT_ISOLATION_VIOLATION', 'No tienes acceso a datos de otro agente', 403, false)
    })

    const res = await GET(makeRequest(), makeContext('agent-other'))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.code).toBe('AGENT_ISOLATION_VIOLATION')
  })

  it('admin can access any agent metrics', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'u2', roles: ['admin'], agentId: undefined })
    mockAuthorizeAgent.mockReturnValue(undefined)

    const res = await GET(makeRequest(), makeContext('agent1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockAuthorizeAgent).toHaveBeenCalledWith(undefined, ['admin'], 'agent1')
    expect(body.verifiedSalesCents).toBe(0)
  })
})
