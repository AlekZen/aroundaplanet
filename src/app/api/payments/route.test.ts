import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// --- Mocks ---
const mockRequireAuth = vi.fn()
const mockRequirePermission = vi.fn()

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}))
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockAdd = vi.fn()
const mockGet = vi.fn()
const mockDoc = vi.fn()
const mockWhere = vi.fn()
const mockOrderBy = vi.fn()
const mockLimit = vi.fn()
const mockStartAfter = vi.fn()
const mockCount = vi.fn()
const mockSelect = vi.fn()

const buildChain = () => ({
  get: mockGet,
  where: (...args: unknown[]) => { mockWhere(...args); return buildChain() },
  orderBy: (...args: unknown[]) => { mockOrderBy(...args); return buildChain() },
  limit: (...args: unknown[]) => { mockLimit(...args); return buildChain() },
  startAfter: (...args: unknown[]) => { mockStartAfter(...args); return buildChain() },
  count: () => ({ get: mockCount }),
  select: (...args: unknown[]) => { mockSelect(...args); return buildChain() },
  add: mockAdd,
  doc: (...args: unknown[]) => { mockDoc(...args); return { get: mockGet, select: (...sArgs: unknown[]) => { mockSelect(...sArgs); return { get: mockGet } } } },
})

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => buildChain(),
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  },
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

describe('GET /api/payments', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockGet.mockReset()
    mockWhere.mockReset()
    mockOrderBy.mockReset()
    mockLimit.mockReset()
  })

  it('returns payment list with status filter', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockGet.mockResolvedValue({
      docs: [
        {
          id: 'pay1',
          data: () => ({
            orderId: 'order1',
            agentId: 'agent1',
            agentName: 'Juan',
            tripName: 'Europa',
            amountCents: 14500000,
            paymentMethod: 'transfer',
            date: { toDate: () => new Date('2026-03-20') },
            registeredBy: 'agent1',
            registeredByName: 'Juan',
            receiptUrl: null,
            status: 'pending_verification',
            verifiedBy: null,
            verifiedAt: null,
            rejectionNote: null,
            notes: null,
            syncedToOdoo: false,
            createdAt: { toDate: () => new Date('2026-03-19') },
            updatedAt: { toDate: () => new Date('2026-03-19') },
          }),
        },
      ],
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments?status=pending_verification')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.payments).toHaveLength(1)
    expect(body.payments[0].id).toBe('pay1')
    expect(body.payments[0].amountCents).toBe(14500000)
    expect(body.payments[0].status).toBe('pending_verification')
  })

  it('returns empty list when no payments', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockGet.mockResolvedValue({ docs: [] })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments')
    const res = await GET(req)
    const body = await res.json()

    expect(body.payments).toHaveLength(0)
    expect(body.nextCursor).toBeNull()
  })
})

describe('POST /api/payments', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequireAuth.mockReset()
    mockGet.mockReset()
    mockAdd.mockReset()
    mockDoc.mockReset()
    mockSelect.mockReset()
  })

  it('creates a payment for a valid order', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'agent1', roles: ['agente'] })

    // Order exists and agent matches
    let getCallCount = 0
    mockGet.mockImplementation(() => {
      getCallCount++
      if (getCallCount === 1) {
        // Order doc
        return Promise.resolve({
          exists: true,
          data: () => ({ agentId: 'agent1', userId: null, tripId: 'trip1' }),
        })
      }
      if (getCallCount === 2) {
        // User profile
        return Promise.resolve({
          exists: true,
          data: () => ({ displayName: 'Juan Lopez', firstName: 'Juan', lastName: 'Lopez' }),
        })
      }
      if (getCallCount === 3) {
        // Trip name
        return Promise.resolve({
          exists: true,
          data: () => ({ odooName: 'Europa 33.8 dias' }),
        })
      }
      // Agent name (no agent for this order path, but just in case)
      return Promise.resolve({ exists: false, data: () => ({}) })
    })

    mockAdd.mockResolvedValue({ id: 'newpay123' })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        orderId: 'order1',
        amountCents: 14500000,
        paymentMethod: 'transfer',
        date: '2026-03-20',
        notes: 'Primer abono',
      }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.paymentId).toBe('newpay123')
    expect(body.status).toBe('pending_verification')
  })

  it('rejects invalid payment data', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'agent1', roles: ['agente'] })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        orderId: '',
        amountCents: -100,
        paymentMethod: 'bitcoin',
        date: '',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects when order not found', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'agent1', roles: ['agente'] })
    mockGet.mockResolvedValue({ exists: false })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        orderId: 'nonexistent',
        amountCents: 5000,
        paymentMethod: 'transfer',
        date: '2026-03-20',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('rejects agent access to another agents order', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'agent2', roles: ['agente'] })
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ agentId: 'agent1', userId: 'client1', tripId: 'trip1' }),
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        orderId: 'order1',
        amountCents: 5000,
        paymentMethod: 'transfer',
        date: '2026-03-20',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})
