import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockCreate = vi.fn()
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ id: 'log1', create: mockCreate }),
    }),
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'TS' },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: (error: unknown) => {
    if (error && typeof error === 'object' && 'status' in error) {
      const e = error as { status: number; code: string; message: string }
      return NextResponse.json({ code: e.code, message: e.message }, { status: e.status })
    }
    return NextResponse.json({ code: 'ERROR' }, { status: 500 })
  },
}))

const makeCtx = (id: string) => ({ params: Promise.resolve({ firestorePaymentId: id }) })

describe('POST /api/admin/payments/reconciliation/[id]/reject', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockCreate.mockReset()
  })

  it('creates log with action=rejected', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockCreate.mockResolvedValue({})

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ odooPaymentId: 7976, reason: 'cliente distinto' }),
    })
    const res = await POST(req, makeCtx('p1'))
    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rejected',
        odooPaymentId: 7976,
        reason: 'cliente distinto',
        adminUid: 'admin1',
      }),
    )
  })

  it('returns 400 si reason vacío', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ odooPaymentId: 7976, reason: '' }),
    })
    const res = await POST(req, makeCtx('p1'))
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
