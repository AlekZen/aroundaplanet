import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRequirePermission, mockCollection, mockUpdate } = vi.hoisted(() => {
  const mockRequirePermission = vi.fn()
  const mockUpdate = vi.fn()
  const mockCollection = vi.fn()
  return { mockRequirePermission, mockCollection, mockUpdate }
})

vi.mock('@/lib/auth/requirePermission', () => ({ requirePermission: mockRequirePermission }))
vi.mock('@/lib/firebase/admin', () => ({ adminDb: { collection: mockCollection } }))
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: vi.fn(() => ({})) } }))

vi.mock('@/lib/errors/AppError', () => ({
  AppError: class AppError extends Error {
    constructor(public code: string, message: string, public status: number = 500, public retryable: boolean = false) {
      super(message); this.name = 'AppError'
    }
  },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: vi.fn((error: unknown) => {
    if (error instanceof Error && 'status' in error) {
      const e = error as unknown as { code: string; message: string; status: number; retryable: boolean }
      return Response.json({ code: e.code, message: e.message, retryable: e.retryable }, { status: e.status })
    }
    return Response.json({ code: 'INTERNAL_ERROR', message: 'Error', retryable: true }, { status: 500 })
  }),
}))

import { PATCH } from './route'
import { NextRequest } from 'next/server'

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/orders/order-1/assign', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeParams(orderId: string) {
  return { params: Promise.resolve({ orderId }) }
}

describe('PATCH /api/orders/[orderId]/assign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequirePermission.mockResolvedValue({ uid: 'admin-1', roles: ['admin'] })
    mockUpdate.mockResolvedValue(undefined)

    mockCollection.mockImplementation((name: string) => {
      if (name === 'users') {
        return {
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ isActive: true, roles: ['agente'], displayName: 'Lupita' }),
            }),
            update: mockUpdate,
          }),
        }
      }
      if (name === 'orders') {
        return {
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ userId: 'user-1', contactName: 'Ana' }),
            }),
            update: mockUpdate,
          }),
        }
      }
      return {}
    })
  })

  it('assigns agent to order and updates user doc', async () => {
    const res = await PATCH(makeRequest({ agentId: 'agent-lupita' }), makeParams('order-1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.orderId).toBe('order-1')
    expect(data.agentId).toBe('agent-lupita')
    expect(data.assigned).toBe(true)
    expect(mockUpdate).toHaveBeenCalledTimes(2) // order + user
  })

  it('returns 404 when agent does not exist', async () => {
    mockCollection.mockImplementation((name: string) => {
      if (name === 'users') {
        return {
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ exists: false }),
          }),
        }
      }
      return {}
    })

    const res = await PATCH(makeRequest({ agentId: 'nonexistent' }), makeParams('order-1'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when user is not an active agent', async () => {
    mockCollection.mockImplementation((name: string) => {
      if (name === 'users') {
        return {
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ isActive: true, roles: ['cliente'] }),
            }),
          }),
        }
      }
      return {}
    })

    const res = await PATCH(makeRequest({ agentId: 'not-agent' }), makeParams('order-1'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid body', async () => {
    const res = await PATCH(makeRequest({}), makeParams('order-1'))
    expect(res.status).toBe(400)
  })

  it('returns 403 for unauthorized users', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(new AppError('INSUFFICIENT_PERMISSION', 'No', 403, false))

    const res = await PATCH(makeRequest({ agentId: 'agent-1' }), makeParams('order-1'))
    expect(res.status).toBe(403)
  })
})
