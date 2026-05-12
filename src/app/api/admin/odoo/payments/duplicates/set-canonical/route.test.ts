import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockRead = vi.fn()
const mockWrite = vi.fn()
vi.mock('@/lib/odoo/client', () => ({
  getOdooClient: () => ({
    read: (...a: unknown[]) => mockRead(...a),
    write: (...a: unknown[]) => mockWrite(...a),
  }),
}))

const mockLogCreate = vi.fn()
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ id: 'log1', create: mockLogCreate }) }),
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

const ALLOWED_WRITE_KEYS = new Set(['x_dup_status', 'x_canonical_payment_id'])

describe('POST /api/admin/odoo/payments/duplicates/set-canonical', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockRead.mockReset()
    mockWrite.mockReset()
    mockLogCreate.mockReset()
  })

  it('happy path: writes SOLO a x_dup_status + x_canonical_payment_id', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    // pre-flight read
    mockRead.mockResolvedValueOnce([
      { id: 1, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], x_dup_status: false, x_canonical_payment_id: false },
      { id: 2, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], x_dup_status: false, x_canonical_payment_id: false },
    ])
    mockWrite.mockResolvedValue(true)
    // post-write read
    mockRead.mockResolvedValueOnce([
      { id: 1, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], x_dup_status: 'canonico', x_canonical_payment_id: false },
      { id: 2, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], x_dup_status: 'secundario', x_canonical_payment_id: [1, 'P1'] },
    ])
    mockLogCreate.mockResolvedValue({})

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ clusterId: 'c_1_2', canonicalOdooId: 1, memberOdooIds: [1, 2] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('success')

    // Assertion estricta: TODOS los writes deben tener exactamente keys permitidas, NADA MAS
    expect(mockWrite).toHaveBeenCalled()
    for (const call of mockWrite.mock.calls) {
      const [model, ids, values] = call
      expect(model).toBe('account.payment')
      expect(Array.isArray(ids)).toBe(true)
      const keys = Object.keys(values as Record<string, unknown>)
      for (const k of keys) {
        expect(ALLOWED_WRITE_KEYS).toContain(k)
      }
      // Sanity: deben tener exactamente las 2 keys
      expect(keys.sort()).toEqual(['x_canonical_payment_id', 'x_dup_status'])
    }
  })

  it('returns 409 already_set si cluster ya tenía canónico', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockRead.mockResolvedValueOnce([
      { id: 1, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], x_dup_status: 'canonico', x_canonical_payment_id: false },
      { id: 2, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], x_dup_status: 'secundario', x_canonical_payment_id: [1, 'P1'] },
    ])

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ clusterId: 'c_1_2', canonicalOdooId: 1, memberOdooIds: [1, 2] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('already_set')
    expect(mockWrite).not.toHaveBeenCalled()
  })

  it('returns 400 invalid_cluster si partners distintos', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockRead.mockResolvedValueOnce([
      { id: 1, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], x_dup_status: false, x_canonical_payment_id: false },
      { id: 2, amount: 5000, date: '2026-01-08', partner_id: [200, 'Y'], x_dup_status: false, x_canonical_payment_id: false },
    ])

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ clusterId: 'c_1_2', canonicalOdooId: 1, memberOdooIds: [1, 2] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('invalid_cluster')
    expect(mockWrite).not.toHaveBeenCalled()
  })

  it('returns 207 partial si post-write verify falla', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockRead.mockResolvedValueOnce([
      { id: 1, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], x_dup_status: false, x_canonical_payment_id: false },
      { id: 2, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], x_dup_status: false, x_canonical_payment_id: false },
    ])
    mockWrite.mockResolvedValue(true)
    // Post-write: ID 2 no quedó actualizado
    mockRead.mockResolvedValueOnce([
      { id: 1, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], x_dup_status: 'canonico', x_canonical_payment_id: false },
      { id: 2, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], x_dup_status: false, x_canonical_payment_id: false },
    ])
    mockLogCreate.mockResolvedValue({})

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ clusterId: 'c_1_2', canonicalOdooId: 1, memberOdooIds: [1, 2] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(207)
    expect((await res.json()).status).toBe('partial')
  })

  it('returns 400 si body inválido (canonicalOdooId no en members)', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ clusterId: 'c', canonicalOdooId: 99, memberOdooIds: [1, 2] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(mockWrite).not.toHaveBeenCalled()
  })
})
