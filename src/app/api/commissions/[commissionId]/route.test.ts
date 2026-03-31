import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// --- Mocks ---
const mockRequirePermission = vi.fn()

vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockUpdate = vi.fn()
const mockDirectGet = vi.fn()
const mockGroupGet = vi.fn()

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    // Direct O(1) lookup when agentId param provided
    doc: () => ({
      get: mockDirectGet,
    }),
    // Fallback collection group scan
    collectionGroup: () => ({
      orderBy: () => ({
        limit: () => ({
          get: mockGroupGet,
        }),
      }),
    }),
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  },
}))

vi.mock('@/lib/errors/AppError', () => ({
  AppError: class AppError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 500,
      public retryable: boolean = false
    ) {
      super(message)
      this.name = 'AppError'
    }
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

const makeContext = (commissionId: string) => ({
  params: Promise.resolve({ commissionId }),
})

/** Helper to build a mock doc snapshot */
const makeDocSnap = (data: Record<string, unknown>) => ({
  exists: true,
  id: 'comm1',
  data: () => data,
  ref: { update: mockUpdate },
})

describe('PATCH /api/commissions/[commissionId]', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockDirectGet.mockReset()
    mockGroupGet.mockReset()
    mockUpdate.mockReset()
  })

  it('approves pending commission (pending→approved)', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDirectGet.mockResolvedValue(makeDocSnap({ status: 'pending', commissionAmountCents: 10000, agentId: 'agent1' }))
    mockUpdate.mockResolvedValue(undefined)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/commissions/comm1?agentId=agent1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    })

    const res = await PATCH(req, makeContext('comm1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.commissionId).toBe('comm1')
    expect(body.status).toBe('approved')
    expect(body.approvedBy).toBe('admin1')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'approved',
        approvedBy: 'admin1',
        updatedAt: 'SERVER_TIMESTAMP',
        approvedAt: 'SERVER_TIMESTAMP',
      })
    )
  })

  it('marks approved commission as paid (approved→paid)', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDirectGet.mockResolvedValue(makeDocSnap({
      status: 'approved',
      commissionAmountCents: 10000,
      approvedBy: 'admin1',
      agentId: 'agent1',
    }))
    mockUpdate.mockResolvedValue(undefined)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/commissions/comm1?agentId=agent1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'paid' }),
    })

    const res = await PATCH(req, makeContext('comm1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('paid')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'paid',
        paidAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      })
    )
  })

  it('rejects invalid transition paid→approved (409)', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDirectGet.mockResolvedValue(makeDocSnap({ status: 'paid', commissionAmountCents: 10000, agentId: 'agent1' }))

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/commissions/comm1?agentId=agent1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    })

    const res = await PATCH(req, makeContext('comm1'))

    expect(res.status).toBe(409)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('adjusts amount on pending commission', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDirectGet.mockResolvedValue(makeDocSnap({ status: 'pending', commissionAmountCents: 10000, agentId: 'agent1' }))
    mockUpdate.mockResolvedValue(undefined)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/commissions/comm1?agentId=agent1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved', commissionAmountCents: 15000 }),
    })

    const res = await PATCH(req, makeContext('comm1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.commissionAmountCents).toBe(15000)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        commissionAmountCents: 15000,
      })
    )
  })

  it('ignores amount adjustment on approved commission', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDirectGet.mockResolvedValue(makeDocSnap({ status: 'approved', commissionAmountCents: 10000, agentId: 'agent1' }))
    mockUpdate.mockResolvedValue(undefined)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/commissions/comm1?agentId=agent1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'paid', commissionAmountCents: 99999 }),
    })

    const res = await PATCH(req, makeContext('comm1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.commissionAmountCents).toBe(10000)

    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ commissionAmountCents: 99999 })
    )
  })

  it('returns 404 when commission not found', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    // Direct lookup returns non-existent
    mockDirectGet.mockResolvedValue({ exists: false })
    // Fallback also returns no match
    mockGroupGet.mockResolvedValue({ docs: [] })

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/commissions/nonexistent?agentId=agent1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    })

    const res = await PATCH(req, makeContext('nonexistent'))

    expect(res.status).toBe(404)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 403 when unauthorized', async () => {
    const authError = Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN', status: 403 })
    mockRequirePermission.mockRejectedValue(authError)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/commissions/comm1?agentId=agent1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    })

    const res = await PATCH(req, makeContext('comm1'))

    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
