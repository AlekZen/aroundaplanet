import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockGet = vi.fn()
const mockUpdate = vi.fn()
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ get: mockGet, update: mockUpdate }),
    }),
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

// firebase-admin/firestore FieldValue mock
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => ({ _methodName: 'FieldValue.serverTimestamp' }),
  },
}))

const makeContext = (paymentId: string) => ({ params: Promise.resolve({ paymentId }) })

const makeReq = (body: unknown) =>
  new NextRequest('http://localhost/api/payments/p1/dismiss-odoo-sync', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

describe('POST /api/payments/[paymentId]/dismiss-odoo-sync', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset().mockResolvedValue({ uid: 'admin-1' })
    mockGet.mockReset()
    mockUpdate.mockReset()
  })

  it('AC8-8 dismiss ok → status=dismissed + reason persistido', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'verified', odooSyncStatus: 'error' }),
    })
    mockUpdate.mockResolvedValue(undefined)

    const { POST } = await import('./route')
    const res = await POST(makeReq({ reason: 'Pago duplicado manual' }), makeContext('p1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.dismissed).toBe(true)

    const updateCall = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.odooSyncStatus).toBe('dismissed')
    expect(updateCall.odooSyncDismissedBy).toBe('admin-1')
    expect(updateCall.odooSyncDismissedReason).toBe('Pago duplicado manual')
  })

  it('AC8-8 ya dismissed → 409', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'verified', odooSyncStatus: 'dismissed' }),
    })

    const { POST } = await import('./route')
    const res = await POST(makeReq({ reason: 'Pago duplicado manual' }), makeContext('p1'))

    expect(res.status).toBe(409)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('400 si reason muy corta', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'verified', odooSyncStatus: 'error' }),
    })

    const { POST } = await import('./route')
    const res = await POST(makeReq({ reason: 'x' }), makeContext('p1'))

    expect(res.status).toBe(400)
  })

  it('404 si pago no existe', async () => {
    mockGet.mockResolvedValue({ exists: false })

    const { POST } = await import('./route')
    const res = await POST(makeReq({ reason: 'Motivo válido aquí' }), makeContext('p1'))

    expect(res.status).toBe(404)
  })
})
