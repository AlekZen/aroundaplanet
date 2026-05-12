import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockGet = vi.fn()
const mockUpdate = vi.fn()
const mockTxGet = vi.fn()
const mockTxUpdate = vi.fn()
const mockTxCreate = vi.fn()

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      doc: (id?: string) => ({
        id: id ?? 'auto_log_id',
        get: mockGet,
        update: mockUpdate,
      }),
      where: () => ({ limit: () => ({}) }),
    }),
    runTransaction: async (fn: (tx: {
      get: (...a: unknown[]) => unknown
      update: (...a: unknown[]) => unknown
      create: (...a: unknown[]) => unknown
    }) => unknown) => {
      return fn({
        get: mockTxGet,
        update: mockTxUpdate,
        create: mockTxCreate,
      })
    },
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

describe('POST /api/admin/payments/reconciliation/[id]/confirm', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockTxGet.mockReset()
    mockTxUpdate.mockReset()
    mockTxCreate.mockReset()
  })

  it('happy path: links payment + creates log', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    // 1st tx.get: payment doc
    mockTxGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ odooPaymentId: null }) })
      // 2nd tx.get: uniqueness query
      .mockResolvedValueOnce({ empty: true })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ odooPaymentId: 7976, confidence: 'high' }),
    })
    const res = await POST(req, makeCtx('p1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.odooPaymentId).toBe(7976)
    expect(mockTxUpdate).toHaveBeenCalled()
    expect(mockTxCreate).toHaveBeenCalled()
  })

  it('returns 409 already_linked if payment already has odooPaymentId', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockTxGet.mockResolvedValueOnce({ exists: true, data: () => ({ odooPaymentId: 1234 }) })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ odooPaymentId: 7976, confidence: 'high' }),
    })
    const res = await POST(req, makeCtx('p1'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('already_linked')
  })

  it('returns 409 odoo_id_taken if otro FS doc ya enlazado al mismo odooPaymentId', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockTxGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ odooPaymentId: null }) })
      .mockResolvedValueOnce({ empty: false, docs: [{ id: 'p_other' }] })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ odooPaymentId: 7976, confidence: 'high' }),
    })
    const res = await POST(req, makeCtx('p1'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('odoo_id_taken')
  })

  it('returns 400 si body inválido', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ odooPaymentId: -1 }),
    })
    const res = await POST(req, makeCtx('p1'))
    expect(res.status).toBe(400)
  })

  it('returns 404 si pago Firestore no existe', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockTxGet.mockResolvedValueOnce({ exists: false })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ odooPaymentId: 7976, confidence: 'high' }),
    })
    const res = await POST(req, makeCtx('p1'))
    expect(res.status).toBe(404)
  })
})
