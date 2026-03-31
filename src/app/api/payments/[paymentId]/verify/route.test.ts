import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// --- Mocks ---
const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockUpdate = vi.fn()
const mockGet = vi.fn()

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({
        get: mockGet,
        update: mockUpdate,
      }),
    }),
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  },
  Timestamp: {
    now: () => ({ seconds: 1234567890 }),
  },
}))

const mockCreateCommission = vi.fn()
vi.mock('./createCommission', () => ({
  createCommissionFromPayment: (...args: unknown[]) => mockCreateCommission(...args),
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

const makeContext = (paymentId: string) => ({
  params: Promise.resolve({ paymentId }),
})

describe('PATCH /api/payments/[paymentId]/verify', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockGet.mockReset()
    mockUpdate.mockReset()
    mockCreateCommission.mockReset()
  })

  it('approves a pending payment', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'pending_verification' }),
    })
    mockUpdate.mockResolvedValue(undefined)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/pay1/verify', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'verify' }),
    })

    const res = await PATCH(req, makeContext('pay1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('verified')
    expect(body.action).toBe('verify')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'verified',
        verifiedBy: 'admin1',
      })
    )
  })

  it('rejects a payment with note', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'pending_verification' }),
    })
    mockUpdate.mockResolvedValue(undefined)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/pay1/verify', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject', rejectionNote: 'Monto no coincide con el comprobante' }),
    })

    const res = await PATCH(req, makeContext('pay1'))
    const body = await res.json()

    expect(body.status).toBe('rejected')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rejected',
        rejectionNote: 'Monto no coincide con el comprobante',
      })
    )
  })

  it('requests info with note', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'pending_verification' }),
    })
    mockUpdate.mockResolvedValue(undefined)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/pay1/verify', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'request_info', rejectionNote: 'Necesito ver el comprobante completo' }),
    })

    const res = await PATCH(req, makeContext('pay1'))
    const body = await res.json()

    expect(body.status).toBe('info_requested')
  })

  it('returns 404 for non-existent payment', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockGet.mockResolvedValue({ exists: false })

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/nonexistent/verify', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'verify' }),
    })

    const res = await PATCH(req, makeContext('nonexistent'))
    expect(res.status).toBe(404)
  })

  it('returns 409 for already verified payment', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'verified' }),
    })

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/pay1/verify', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'verify' }),
    })

    const res = await PATCH(req, makeContext('pay1'))
    expect(res.status).toBe(409)
  })

  it('rejects reject action without note', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/pay1/verify', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject' }),
    })

    const res = await PATCH(req, makeContext('pay1'))
    expect(res.status).toBe(400)
  })

  // --- Commission Hook Tests (F14) ---

  it('calls createCommission when verifying payment', async () => {
    const paymentData = { status: 'pending_verification', agentId: 'agent1', amountCents: 50000 }
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockGet.mockResolvedValue({ exists: true, data: () => paymentData })
    mockUpdate.mockResolvedValue(undefined)
    mockCreateCommission.mockResolvedValue(undefined)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/pay1/verify', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'verify' }),
    })

    await PATCH(req, makeContext('pay1'))
    expect(mockCreateCommission).toHaveBeenCalledWith('pay1', paymentData)
  })

  it('does NOT call createCommission on reject action', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'pending_verification' }),
    })
    mockUpdate.mockResolvedValue(undefined)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/pay1/verify', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject', rejectionNote: 'Monto incorrecto' }),
    })

    await PATCH(req, makeContext('pay1'))
    expect(mockCreateCommission).not.toHaveBeenCalled()
  })

  it('does NOT call createCommission on request_info action', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'pending_verification' }),
    })
    mockUpdate.mockResolvedValue(undefined)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/pay1/verify', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'request_info' }),
    })

    await PATCH(req, makeContext('pay1'))
    expect(mockCreateCommission).not.toHaveBeenCalled()
  })

  it('completes verify even when createCommission throws', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'pending_verification', agentId: 'agent1', amountCents: 50000 }),
    })
    mockUpdate.mockResolvedValue(undefined)
    mockCreateCommission.mockRejectedValue(new Error('Firestore unavailable'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/pay1/verify', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'verify' }),
    })

    const res = await PATCH(req, makeContext('pay1'))
    expect(res.status).toBe(200)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
