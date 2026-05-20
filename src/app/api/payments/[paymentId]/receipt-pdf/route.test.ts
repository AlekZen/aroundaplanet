import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: () => mockRequireAuth(),
}))

interface DocSpec {
  exists: boolean
  data?: Record<string, unknown>
}

const docs: Record<string, Record<string, DocSpec>> = {
  payments: {},
  orders: {},
  trips: {},
  users: {},
}

const queryResults: Record<string, Array<{ id: string; data: () => Record<string, unknown> }>> = {
  payments: [],
}

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const spec = docs[name]?.[id] ?? { exists: false }
          return {
            exists: spec.exists,
            id,
            data: () => spec.data ?? null,
          }
        },
      }),
      where: () => ({
        where: () => ({
          get: async () => ({ docs: queryResults[name] ?? [] }),
        }),
      }),
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

const makeContext = (paymentId: string) => ({ params: Promise.resolve({ paymentId }) })

function resetDocs() {
  docs.payments = {}
  docs.orders = {}
  docs.trips = {}
  docs.users = {}
  queryResults.payments = []
}

describe('GET /api/payments/[paymentId]/receipt-pdf', () => {
  beforeEach(() => {
    mockRequireAuth.mockReset()
    resetDocs()
  })

  it('401 sin auth', async () => {
    mockRequireAuth.mockRejectedValue({
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'Sesion requerida',
    })
    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), makeContext('p1'))
    expect(res.status).toBe(401)
  })

  it('404 si el pago no existe', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), makeContext('p-missing'))
    expect(res.status).toBe(404)
  })

  it('403 si el solicitante no es admin, agente match ni cliente match', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'random-user', roles: ['cliente'] })
    docs.payments['p1'] = {
      exists: true,
      data: {
        orderId: 'o1',
        agentId: 'agent-x',
        clientId: 'client-y',
        status: 'verified',
        amountCents: 100000,
      },
    }
    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), makeContext('p1'))
    expect(res.status).toBe(403)
  })

  it('409 si el pago aún no está verified', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    docs.payments['p1'] = {
      exists: true,
      data: { status: 'pending_verification', amountCents: 100000 },
    }
    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), makeContext('p1'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('RECEIPT_NOT_AVAILABLE')
  })

  it('200 con PDF para admin sobre pago verified', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    docs.payments['p1'] = {
      exists: true,
      data: {
        orderId: 'o1',
        agentId: 'agent-x',
        clientId: 'client-y',
        clientName: 'Felipe Rubio',
        clientPhone: '+52 33 1234',
        status: 'verified',
        amountCents: 500000,
        paymentMethod: 'transfer',
        bankName: 'BBVA',
        bankReference: 'REF-1',
        date: new Date('2026-05-15T12:00:00Z'),
        verifiedAt: new Date('2026-05-16T12:00:00Z'),
      },
    }
    docs.orders['o1'] = {
      exists: true,
      data: { amountTotalCents: 14500000, tripId: 't1', contactName: 'Felipe Rubio' },
    }
    docs.trips['t1'] = { exists: true, data: { odooName: 'VUELTA AL MUNDO 2026' } }
    queryResults.payments = [
      {
        id: 'p1',
        data: () => ({ amountCents: 500000, date: new Date('2026-05-15T12:00:00Z') }),
      },
    ]

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), makeContext('p1'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toContain('recibo-R-')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(0, 4).toString('ascii')).toBe('%PDF')
  }, 15000)

  it('200 cuando el agente solicita su propio pago', async () => {
    mockRequireAuth.mockResolvedValue({
      uid: 'agent-uid',
      roles: ['agente'],
      agentId: 'agent-x',
    })
    docs.payments['p1'] = {
      exists: true,
      data: {
        orderId: 'o1',
        agentId: 'agent-x',
        clientId: 'client-y',
        status: 'verified',
        amountCents: 200000,
        paymentMethod: 'transfer',
        date: new Date('2026-05-15T12:00:00Z'),
        verifiedAt: new Date('2026-05-16T12:00:00Z'),
      },
    }
    docs.orders['o1'] = { exists: true, data: { amountTotalCents: 14500000 } }
    queryResults.payments = [
      { id: 'p1', data: () => ({ amountCents: 200000, date: new Date('2026-05-15T12:00:00Z') }) },
    ]

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), makeContext('p1'))
    expect(res.status).toBe(200)
  }, 15000)

  it('403 cuando el agente NO es el dueño del pago', async () => {
    mockRequireAuth.mockResolvedValue({
      uid: 'agent-other-uid',
      roles: ['agente'],
      agentId: 'agent-other',
    })
    docs.payments['p1'] = {
      exists: true,
      data: {
        agentId: 'agent-x',
        clientId: 'client-y',
        status: 'verified',
        amountCents: 200000,
      },
    }
    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), makeContext('p1'))
    expect(res.status).toBe(403)
  })

  it('200 cuando el cliente solicita su propio pago (via registeredBy)', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'client-uid', roles: ['cliente'] })
    docs.payments['p1'] = {
      exists: true,
      data: {
        orderId: 'o1',
        agentId: 'agent-x',
        clientId: null,
        registeredBy: 'client-uid',
        status: 'verified',
        amountCents: 100000,
        paymentMethod: 'transfer',
        date: new Date('2026-05-15T12:00:00Z'),
        verifiedAt: new Date('2026-05-16T12:00:00Z'),
      },
    }
    docs.orders['o1'] = { exists: true, data: { amountTotalCents: 14500000 } }
    queryResults.payments = [
      { id: 'p1', data: () => ({ amountCents: 100000, date: new Date('2026-05-15T12:00:00Z') }) },
    ]

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), makeContext('p1'))
    expect(res.status).toBe(200)
  }, 15000)
})
