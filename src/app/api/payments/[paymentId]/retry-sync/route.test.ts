import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockGet = vi.fn()
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ get: mockGet }) }),
  },
}))

const mockSync = vi.fn()
vi.mock('@/lib/odoo/payments-push', () => ({
  syncVerifiedPaymentToOdoo: (...a: unknown[]) => mockSync(...a),
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

const makeContext = (paymentId: string) => ({ params: Promise.resolve({ paymentId }) })

describe('POST /api/payments/[paymentId]/retry-sync', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset().mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockGet.mockReset()
    mockSync.mockReset()
  })

  it('reintenta desde error → status=synced', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'verified', odooSyncStatus: 'error', clientName: 'C' }),
    })
    mockSync.mockResolvedValue({ status: 'synced', odooPaymentId: 8500, isNew: true, orphan: false })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/p1/retry-sync', { method: 'POST' })
    const res = await POST(req, makeContext('p1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('synced')
    expect(body.odooPaymentId).toBe(8500)
  })

  it('reintenta desde orphan → llama sync', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'verified', odooSyncStatus: 'orphan', odooPaymentId: 8400 }),
    })
    mockSync.mockResolvedValue({ status: 'synced', odooPaymentId: 8400, isNew: false, orphan: false })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/p1/retry-sync', { method: 'POST' })
    const res = await POST(req, makeContext('p1'))
    expect(res.status).toBe(200)
    expect(mockSync).toHaveBeenCalled()
  })

  it('409 si ya synced', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'verified', odooSyncStatus: 'synced', odooPaymentId: 8000 }),
    })
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/p1/retry-sync', { method: 'POST' })
    const res = await POST(req, makeContext('p1'))
    expect(res.status).toBe(409)
  })

  it('409 si legacy_linked (read-only)', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'verified', odooSyncStatus: 'legacy_linked', odooPaymentId: 7000 }),
    })
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/p1/retry-sync', { method: 'POST' })
    const res = await POST(req, makeContext('p1'))
    expect(res.status).toBe(409)
  })

  it('409 si pago no verificado todavía', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'pending_verification' }),
    })
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/p1/retry-sync', { method: 'POST' })
    const res = await POST(req, makeContext('p1'))
    expect(res.status).toBe(409)
  })

  it('404 si no existe', async () => {
    mockGet.mockResolvedValue({ exists: false })
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/p1/retry-sync', { method: 'POST' })
    const res = await POST(req, makeContext('p1'))
    expect(res.status).toBe(404)
  })
})
