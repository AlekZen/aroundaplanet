import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: () => mockRequireAuth(),
}))

interface QueryDoc {
  id: string
  data: () => Record<string, unknown>
}

let orderDocs: QueryDoc[] = []
let paymentDocs: QueryDoc[] = []

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: (name: string) => ({
      where: () => {
        // chain for `.where().where().limit().get()`
        const builder = {
          where: () => builder,
          limit: () => builder,
          get: async () => ({
            docs: name === 'orders' ? orderDocs : paymentDocs,
          }),
        }
        return builder
      },
    }),
  },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: (error: unknown) => {
    if (error && typeof error === 'object' && 'status' in error) {
      const e = error as { status: number; code: string; message: string }
      return NextResponse.json({ code: e.code, message: e.message }, { status: e.status })
    }
    return NextResponse.json({ code: 'ERROR', message: String(error) }, { status: 500 })
  },
}))

describe('GET /api/agent/orders-contract-map', () => {
  beforeEach(() => {
    mockRequireAuth.mockReset()
    orderDocs = []
    paymentDocs = []
  })

  it('401 sin auth', async () => {
    mockRequireAuth.mockRejectedValue({
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'Sesion requerida',
    })
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('403 sin agentId en claims', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'u1', roles: ['cliente'] })
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('200 con orden + contractId + pagos verified agrupados', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'agent-uid', roles: ['agente'], agentId: 'agent-1' })
    orderDocs = [
      { id: 'o1', data: () => ({ contractId: 'c1', agentId: 'agent-1' }) },
      { id: 'o2', data: () => ({ contractId: null, agentId: 'agent-1' }) },
    ]
    paymentDocs = [
      { id: 'p1', data: () => ({ orderId: 'o1', amountCents: 100000, date: '2026-05-15T00:00:00Z' }) },
      { id: 'p2', data: () => ({ orderId: 'o1', amountCents: 200000, date: '2026-05-20T00:00:00Z' }) },
      { id: 'p3', data: () => ({ orderId: 'o2', amountCents: 50000, date: '2026-05-10T00:00:00Z' }) },
    ]
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.orders.o1.contractId).toBe('c1')
    expect(body.orders.o1.verifiedPayments).toHaveLength(2)
    // Orden por fecha descendente
    expect(body.orders.o1.verifiedPayments[0].paymentId).toBe('p2')
    expect(body.orders.o2.contractId).toBeNull()
    expect(body.orders.o2.verifiedPayments).toHaveLength(1)
  })

  it('200 con map vacío si el agente no tiene órdenes ni pagos', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'agent-uid', roles: ['agente'], agentId: 'agent-1' })
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.orders).toEqual({})
  })

  it('crea entry vacía cuando hay pago verified pero la orden no está en el map', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'agent-uid', roles: ['agente'], agentId: 'agent-1' })
    paymentDocs = [
      { id: 'p1', data: () => ({ orderId: 'orphan-order', amountCents: 100000, date: '2026-05-15' }) },
    ]
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()
    expect(body.orders['orphan-order']).toBeDefined()
    expect(body.orders['orphan-order'].contractId).toBeNull()
    expect(body.orders['orphan-order'].verifiedPayments).toHaveLength(1)
  })
})
