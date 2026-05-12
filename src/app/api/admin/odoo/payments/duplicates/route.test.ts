import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockSearchRead = vi.fn()
vi.mock('@/lib/odoo/client', () => ({
  getOdooClient: () => ({ searchRead: (...a: unknown[]) => mockSearchRead(...a) }),
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

describe('GET /api/admin/odoo/payments/duplicates', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockSearchRead.mockReset()
  })

  it('returns clusters with state', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockSearchRead.mockResolvedValueOnce([
      { id: 1, name: 'P1', ref: false, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
      { id: 2, name: 'P2', ref: false, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
      { id: 3, name: 'P3', ref: false, amount: 999, date: '2025-12-01', partner_id: [200, 'Y'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
    ]).mockResolvedValueOnce([])

    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.totalClusters).toBe(1)
    expect(body.summary.unmarked).toBe(1)
    expect(body.clusters[0].members).toHaveLength(2)
  })

  it('detects canonical_set state', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockSearchRead.mockResolvedValueOnce([
      { id: 1, name: 'P1', ref: false, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: 'canonico', x_canonical_payment_id: false },
      { id: 2, name: 'P2', ref: false, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: 'secundario', x_canonical_payment_id: [1, 'P1'] },
    ]).mockResolvedValueOnce([])

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()
    expect(body.summary.canonicalSet).toBe(1)
    expect(body.clusters[0].canonicalId).toBe(1)
  })

  it('returns 403 si caller sin permiso', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(new AppError('INSUFFICIENT_PERMISSION', 'denied', 403, false))

    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(403)
  })
})
