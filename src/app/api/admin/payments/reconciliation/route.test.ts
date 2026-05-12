import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { clearInflightCache } from '@/lib/odoo/inflightCache'

const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockFsGet = vi.fn()
const mockLogGet = vi.fn()
const mockOrderGet = vi.fn()
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: (name: string) => ({
      where: () => ({
        where: () => ({ get: name === 'paymentReconciliationLog' ? mockLogGet : mockFsGet }),
        get: name === 'paymentReconciliationLog' ? mockLogGet : mockFsGet,
      }),
      get: mockFsGet,
      doc: (id: string) => ({
        get: () => (name === 'orders' ? mockOrderGet(id) : Promise.resolve({ exists: false, data: () => ({}) })),
      }),
    }),
  },
}))

const mockSearchRead = vi.fn()
vi.mock('@/lib/odoo/client', () => ({
  getOdooClient: () => ({
    searchRead: (...args: unknown[]) => mockSearchRead(...args),
  }),
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

describe('GET /api/admin/payments/reconciliation', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockFsGet.mockReset()
    mockLogGet.mockReset()
    mockSearchRead.mockReset()
    clearInflightCache()
  })

  it('responds with buckets for high/medium/low/none', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockFsGet.mockResolvedValue({
      docs: [
        { id: 'p1', data: () => ({ clientName: 'Felipe Rubio', amountCents: 500000, date: '2026-01-08', odooPaymentId: null }) },
        { id: 'p2', data: () => ({ clientName: 'Carlos Solo', amountCents: 100000, date: '2026-02-01', odooPaymentId: null }) },
      ],
    })
    mockLogGet.mockResolvedValue({ docs: [] })
    mockSearchRead.mockResolvedValueOnce([
      { id: 7976, name: 'P-1', memo: null, amount: 5000, date: '2026-01-08', partner_id: [4314, 'Felipe Rubio'], state: 'paid', journal_id: [13, 'Bank'] },
    ]).mockResolvedValueOnce([])

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/admin/payments/reconciliation')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.high).toBe(1)
    expect(body.summary.none).toBe(1)
    expect(body.buckets.high).toHaveLength(1)
    expect(body.buckets.high[0].odooId).toBe(7976)
    expect(body.buckets.none).toHaveLength(1)
  })

  it('excludes pares previamente rejected', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockFsGet.mockResolvedValue({
      docs: [
        { id: 'p1', data: () => ({ clientName: 'Felipe', amountCents: 500000, date: '2026-01-08', odooPaymentId: null }) },
      ],
    })
    mockLogGet.mockResolvedValue({
      docs: [{ data: () => ({ firestorePaymentId: 'p1', odooPaymentId: 7976, action: 'rejected' }) }],
    })
    mockSearchRead.mockResolvedValueOnce([
      { id: 7976, name: null, memo: null, amount: 5000, date: '2026-01-08', partner_id: [1, 'Felipe'], state: 'paid', journal_id: [13, 'Bank'] },
    ]).mockResolvedValueOnce([])

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/x'))
    const body = await res.json()
    expect(body.summary.high).toBe(0)
    expect(body.summary.none).toBe(1)
  })

  it('returns 403 si caller no tiene payments:verify', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(new AppError('INSUFFICIENT_PERMISSION', 'denied', 403, false))

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(403)
  })

  it('warning missing_clientName se propaga', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockFsGet.mockResolvedValue({
      docs: [{ id: 'p1', data: () => ({ clientName: null, amountCents: 100, date: '2026-01-01', odooPaymentId: null }) }],
    })
    mockLogGet.mockResolvedValue({ docs: [] })
    mockSearchRead.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/x'))
    const body = await res.json()
    expect(body.buckets.none[0].warnings).toContain('missing_clientName')
  })

  it('filtra a pagos enlazados con status=matched', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockFsGet.mockResolvedValue({
      docs: [
        { id: 'p1', data: () => ({ clientName: 'X', amountCents: 100, date: '2026-01-01', odooPaymentId: 7976 }) },
        { id: 'p2', data: () => ({ clientName: 'Y', amountCents: 200, date: '2026-01-01', odooPaymentId: null }) },
      ],
    })
    mockLogGet.mockResolvedValue({ docs: [] })
    mockSearchRead.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/x?status=matched'))
    const body = await res.json()
    expect(body.summary.matched).toBe(1)
  })
})
