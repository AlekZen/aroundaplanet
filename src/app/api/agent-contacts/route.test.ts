import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockRequireAuth, mockCollection, mockGet, mockWhere, mockOrderBy, mockAdd } = vi.hoisted(() => {
  const mockRequireAuth = vi.fn()
  const mockGet = vi.fn()
  const mockWhere = vi.fn()
  const mockOrderBy = vi.fn()
  const mockAdd = vi.fn()
  const mockCollection = vi.fn()
  return { mockRequireAuth, mockCollection, mockGet, mockWhere, mockOrderBy, mockAdd }
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

import { POST, GET } from './route'

describe('POST /api/agent-contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ uid: 'u1', roles: ['agente'], agentId: 'agent-lupita' })
    mockAdd.mockResolvedValue({ id: 'contact-1' })
    mockCollection.mockReturnValue({ add: mockAdd })
  })

  it('creates contact and returns 201', async () => {
    const req = new NextRequest('http://localhost/api/agent-contacts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Juan Perez', email: 'juan@test.com', city: 'Guadalajara' }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.contactId).toBe('contact-1')
    expect(data.name).toBe('Juan Perez')
    expect(data.agentId).toBe('agent-lupita')
    expect(data.source).toBe('platform')
    expect(data.odooPartnerId).toBeNull()

    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      agentId: 'agent-lupita',
      name: 'Juan Perez',
      email: 'juan@test.com',
      city: 'Guadalajara',
      source: 'platform',
      odooPartnerId: null,
    }))
  })

  it('returns 403 when user has no agentId', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'u2', roles: ['cliente'] })

    const req = new NextRequest('http://localhost/api/agent-contacts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 when body is invalid (name too short)', async () => {
    const req = new NextRequest('http://localhost/api/agent-contacts', {
      method: 'POST',
      body: JSON.stringify({ name: 'A' }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when name is missing', async () => {
    const req = new NextRequest('http://localhost/api/agent-contacts', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/agent-contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ uid: 'u1', roles: ['agente'], agentId: 'agent-lupita' })

    mockGet.mockResolvedValue({ docs: [] })
    mockOrderBy.mockReturnValue({ get: mockGet })
    mockWhere.mockReturnValue({ orderBy: mockOrderBy })
    mockCollection.mockReturnValue({ where: mockWhere })
  })

  it('returns contacts for the agent', async () => {
    mockGet.mockResolvedValue({
      docs: [
        { id: 'c1', data: () => ({ name: 'Juan', email: 'j@t.com', agentId: 'agent-lupita', source: 'platform' }) },
        { id: 'c2', data: () => ({ name: 'Maria', email: null, agentId: 'agent-lupita', source: 'platform' }) },
      ],
    })

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.contacts).toHaveLength(2)
    expect(data.total).toBe(2)
    expect(data.contacts[0].name).toBe('Juan')
  })

  it('returns empty list when no contacts', async () => {
    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.contacts).toHaveLength(0)
    expect(data.total).toBe(0)
  })

  it('returns 403 when user has no agentId and is not admin', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'u2', roles: ['cliente'] })

    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 400 when admin has no agentId param', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'u3', roles: ['superadmin'] })

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
  })
})
