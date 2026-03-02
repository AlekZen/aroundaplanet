import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockRequireAuth, mockCollection, mockGet, mockWhere, mockOrderBy, mockSelect } = vi.hoisted(() => {
  const mockRequireAuth = vi.fn()
  const mockGet = vi.fn()
  const mockWhere = vi.fn()
  const mockOrderBy = vi.fn()
  const mockSelect = vi.fn()
  const mockCollection = vi.fn()
  return { mockRequireAuth, mockCollection, mockGet, mockWhere, mockOrderBy, mockSelect }
})

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: mockRequireAuth,
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: mockCollection },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: vi.fn(() => ({})) },
}))

vi.mock('@/lib/errors/AppError', () => ({
  AppError: class AppError extends Error {
    constructor(public code: string, message: string, public status: number = 500, public retryable: boolean = false) {
      super(message)
      this.name = 'AppError'
    }
  },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: vi.fn((error: unknown) => {
    if (error instanceof Error && 'status' in error) {
      const e = error as unknown as { code: string; message: string; status: number; retryable: boolean }
      return Response.json({ code: e.code, message: e.message, retryable: e.retryable }, { status: e.status })
    }
    return Response.json({ code: 'INTERNAL_ERROR', message: 'Error interno', retryable: true }, { status: 500 })
  }),
}))

import { GET } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/agents/agent-lupita/orders')
}

describe('GET /api/agents/[agentId]/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ uid: 'u1', roles: ['agente'], agentId: 'agent-lupita' })

    // Chainable query mock
    mockGet.mockResolvedValue({ docs: [] })
    mockSelect.mockReturnValue({ get: mockGet })
    mockOrderBy.mockReturnValue({ select: mockSelect })
    mockWhere.mockReturnValue({ orderBy: mockOrderBy })

    mockCollection.mockImplementation((name: string) => {
      if (name === 'orders') return { where: mockWhere }
      if (name === 'trips') return { doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) }) }
      return {}
    })
  })

  it('returns 200 with agent orders', async () => {
    mockGet.mockResolvedValue({
      docs: [
        { id: 'order-1', data: () => ({ contactName: 'Juan', tripId: 'trip-1', status: 'Interesado', amountTotalCents: 14500000, createdAt: {} }) },
        { id: 'order-2', data: () => ({ contactName: 'Maria', tripId: 'trip-1', status: 'Confirmado', amountTotalCents: 14500000, createdAt: {} }) },
      ],
    })

    const mockTripGet = vi.fn().mockResolvedValue({ exists: true, id: 'trip-1', data: () => ({ odooName: 'Vuelta al Mundo' }) })
    mockCollection.mockImplementation((name: string) => {
      if (name === 'orders') return { where: mockWhere }
      if (name === 'trips') return { doc: vi.fn().mockReturnValue({ get: mockTripGet }) }
      return {}
    })

    const res = await GET(makeRequest(), { params: Promise.resolve({ agentId: 'agent-lupita' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.orders).toHaveLength(2)
    expect(data.orders[0].contactName).toBe('Juan')
    expect(data.orders[0].tripName).toBe('Vuelta al Mundo')
    expect(data.total).toBe(2)
  })

  it('returns empty array when agent has no orders', async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ agentId: 'agent-lupita' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.orders).toHaveLength(0)
    expect(data.total).toBe(0)
  })

  it('returns 403 when agent tries to view another agents orders', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'u2', roles: ['agente'], agentId: 'agent-other' })

    const res = await GET(makeRequest(), { params: Promise.resolve({ agentId: 'agent-lupita' }) })
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.code).toBe('INSUFFICIENT_PERMISSION')
  })

  it('returns 401 when not authenticated', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequireAuth.mockRejectedValue(new AppError('AUTH_REQUIRED', 'Auth requerida', 401, false))

    const res = await GET(makeRequest(), { params: Promise.resolve({ agentId: 'agent-lupita' }) })

    expect(res.status).toBe(401)
  })
})
