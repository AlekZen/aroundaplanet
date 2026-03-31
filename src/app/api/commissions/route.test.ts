import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// --- Mocks ---
const mockRequireAuth = vi.fn()

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}))

const mockGet = vi.fn()
const mockWhere = vi.fn()
const mockOrderBy = vi.fn()
const mockLimit = vi.fn()

const buildChain = () => ({
  get: mockGet,
  where: (...args: unknown[]) => { mockWhere(...args); return buildChain() },
  orderBy: (...args: unknown[]) => { mockOrderBy(...args); return buildChain() },
  limit: (...args: unknown[]) => { mockLimit(...args); return buildChain() },
})

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collectionGroup: () => buildChain(),
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  },
}))

vi.mock('@/config/roles', () => ({
  AGENT_OVERRIDE_ROLES: ['admin', 'director', 'superadmin'],
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: (error: unknown) => {
    if (error && typeof error === 'object' && 'status' in error) {
      const e = error as { status: number; code: string; message: string }
      return NextResponse.json({ code: e.code, message: e.message }, { status: e.status })
    }
    return NextResponse.json({ code: 'ERROR', message: 'Unknown' }, { status: 500 })
  },
}))

describe('GET /api/commissions', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequireAuth.mockReset()
    mockGet.mockReset()
    mockWhere.mockReset()
    mockOrderBy.mockReset()
    mockLimit.mockReset()
  })

  it('agent sees only own commissions with approved/paid filter', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'u1', roles: ['agente'], agentId: 'agent-lupita' })
    mockGet.mockResolvedValue({
      docs: [
        { id: 'comm1', data: () => ({ agentId: 'agent-lupita', status: 'approved', period: '2026-03' }) },
        { id: 'comm2', data: () => ({ agentId: 'agent-lupita', status: 'paid', period: '2026-03' }) },
      ],
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/commissions')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.commissions).toHaveLength(2)
    expect(body.total).toBe(2)

    // Agent filter: where agentId == 'agent-lupita'
    expect(mockWhere).toHaveBeenCalledWith('agentId', '==', 'agent-lupita')
    // Agent status restriction: only approved/paid
    expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['approved', 'paid'])
  })

  it('admin sees all commissions', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'adminUid', roles: ['admin'] })
    mockGet.mockResolvedValue({
      docs: [
        { id: 'comm1', data: () => ({ agentId: 'agent-a', status: 'pending', period: '2026-03' }) },
        { id: 'comm2', data: () => ({ agentId: 'agent-b', status: 'approved', period: '2026-02' }) },
      ],
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/commissions')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.commissions).toHaveLength(2)
    expect(body.total).toBe(2)

    // Admin with no filters: no agentId where clause, no status in clause
    expect(mockWhere).not.toHaveBeenCalledWith('agentId', '==', expect.any(String))
    expect(mockWhere).not.toHaveBeenCalledWith('status', 'in', expect.anything())
  })

  it('admin filters by agentId param', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'adminUid', roles: ['admin'] })
    mockGet.mockResolvedValue({
      docs: [
        { id: 'comm3', data: () => ({ agentId: 'agent-carlos', status: 'pending', period: '2026-03' }) },
      ],
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/commissions?agentId=agent-carlos')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.commissions).toHaveLength(1)

    // Admin filtering by explicit agentId query param
    expect(mockWhere).toHaveBeenCalledWith('agentId', '==', 'agent-carlos')
    // Should NOT apply the agent status restriction
    expect(mockWhere).not.toHaveBeenCalledWith('status', 'in', ['approved', 'paid'])
  })

  it('filters by status param', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'adminUid', roles: ['admin'] })
    mockGet.mockResolvedValue({
      docs: [
        { id: 'comm4', data: () => ({ agentId: 'agent-a', status: 'pending', period: '2026-03' }) },
      ],
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/commissions?status=pending')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.commissions).toHaveLength(1)

    // Admin status filter applied as equality
    expect(mockWhere).toHaveBeenCalledWith('status', '==', 'pending')
  })

  it('filters by period param', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'adminUid', roles: ['admin'] })
    mockGet.mockResolvedValue({
      docs: [
        { id: 'comm5', data: () => ({ agentId: 'agent-a', status: 'paid', period: '2026-03' }) },
      ],
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/commissions?period=2026-03')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.commissions).toHaveLength(1)

    expect(mockWhere).toHaveBeenCalledWith('period', '==', '2026-03')
  })

  it('returns empty list when no commissions', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'adminUid', roles: ['admin'] })
    mockGet.mockResolvedValue({ docs: [] })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/commissions')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.commissions).toHaveLength(0)
    expect(body.total).toBe(0)
  })
})
