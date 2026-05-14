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

describe('POST /api/payments/[paymentId]/retry-odoo-push', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset().mockResolvedValue({ uid: 'admin-1' })
    mockGet.mockReset()
    mockSync.mockReset()
  })

  it('AC8-6 push ok → 200 con odooPaymentId', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'verified', odooSyncStatus: 'error', clientName: 'Test' }),
    })
    mockSync.mockResolvedValue({ status: 'synced', odooPaymentId: 9100, isNew: true, orphan: false })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/p1/retry-odoo-push', {
      method: 'POST',
    })
    const res = await POST(req, makeContext('p1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.odooPaymentId).toBe(9100)
  })

  it('AC8-7 push falla → 502 con error', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'verified', odooSyncStatus: 'error', clientName: 'Test' }),
    })
    mockSync.mockResolvedValue({
      status: 'error',
      error: 'Odoo no disponible',
      odooPaymentId: null,
      isNew: false,
      orphan: false,
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/p1/retry-odoo-push', {
      method: 'POST',
    })
    const res = await POST(req, makeContext('p1'))
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.ok).toBe(false)
    expect(body.error).toBeTruthy()
  })

  it('409 si dismissed', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'verified', odooSyncStatus: 'dismissed' }),
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/p1/retry-odoo-push', {
      method: 'POST',
    })
    const res = await POST(req, makeContext('p1'))

    expect(res.status).toBe(409)
  })

  it('404 si pago no existe', async () => {
    mockGet.mockResolvedValue({ exists: false })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/p1/retry-odoo-push', {
      method: 'POST',
    })
    const res = await POST(req, makeContext('p1'))

    expect(res.status).toBe(404)
  })
})
