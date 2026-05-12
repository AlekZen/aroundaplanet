import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { clearInflightCache } from '@/lib/odoo/inflightCache'

const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockSearchRead = vi.fn()
const mockRead = vi.fn()
vi.mock('@/lib/odoo/client', () => ({
  getOdooClient: () => ({ searchRead: (...a: unknown[]) => mockSearchRead(...a), read: (...a: unknown[]) => mockRead(...a) }),
}))

// adminDb: collection().get() devuelve { docs: [] } por default; collection().doc().get() returns exists:false
const mockCollectionGet = vi.fn().mockResolvedValue({ docs: [] })
const mockDocGet = vi.fn().mockResolvedValue({ exists: false, data: () => ({}) })
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      get: () => mockCollectionGet(),
      doc: () => ({ get: () => mockDocGet() }),
    }),
  },
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

const mkRequest = (qs = '') => new NextRequest(`http://localhost/api/admin/odoo/payments/duplicates${qs}`)

describe('GET /api/admin/odoo/payments/duplicates', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockSearchRead.mockReset()
    mockRead.mockReset()
    mockCollectionGet.mockReset().mockResolvedValue({ docs: [] })
    mockDocGet.mockReset().mockResolvedValue({ exists: false, data: () => ({}) })
    clearInflightCache()
  })

  it('returns clusters con sameTrip/sameAgent/maxDateDiffDays computados', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockSearchRead
      // 1ra page payments
      .mockResolvedValueOnce([
        { id: 1, name: 'P1', memo: false, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
        { id: 2, name: 'P2', memo: false, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
      ])
      // 2da page vacía
      .mockResolvedValueOnce([])
    // enrichment internal: payments sin memo → no llama searchRead account.move
    mockRead.mockResolvedValueOnce([]) // account.payment extras

    const { GET } = await import('./route')
    const res = await GET(mkRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.totalClusters).toBe(1)
    expect(body.clusters[0].sameTrip).toBeNull() // sin tripName en miembros
    expect(body.clusters[0].maxDateDiffDays).toBe(0)
  })

  it('filtra clusters dismissed por default', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockSearchRead.mockResolvedValueOnce([
      { id: 1, name: 'P1', memo: false, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
      { id: 2, name: 'P2', memo: false, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
    ]).mockResolvedValueOnce([])
    mockRead.mockResolvedValueOnce([])
    // Mock que el cluster está dismissed
    mockCollectionGet
      .mockResolvedValueOnce({ docs: [{ id: 'c_1_2', data: () => ({}) }] }) // dismissals
      .mockResolvedValueOnce({ docs: [] }) // flags

    const { GET } = await import('./route')
    const res = await GET(mkRequest())
    const body = await res.json()
    expect(body.clusters).toHaveLength(0)
  })

  it('?includeDismissed=true muestra dismissed con flag', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockSearchRead.mockResolvedValueOnce([
      { id: 1, name: 'P1', memo: false, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
      { id: 2, name: 'P2', memo: false, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
    ]).mockResolvedValueOnce([])
    mockRead.mockResolvedValueOnce([])
    mockCollectionGet
      .mockResolvedValueOnce({ docs: [{ id: 'c_1_2', data: () => ({}) }] })
      .mockResolvedValueOnce({ docs: [] })

    const { GET } = await import('./route')
    const res = await GET(mkRequest('?includeDismissed=true'))
    const body = await res.json()
    expect(body.clusters).toHaveLength(1)
    expect(body.clusters[0].dismissed).toBe(true)
  })

  it('flagged clusters suben al inicio (sort por riesgo)', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockSearchRead
      .mockResolvedValueOnce([
        // cluster A (1+2) sin flag
        { id: 1, name: 'P1', memo: false, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
        { id: 2, name: 'P2', memo: false, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
        // cluster B (10+11) con flag
        { id: 10, name: 'P10', memo: false, amount: 999, date: '2026-02-01', partner_id: [200, 'Y'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
        { id: 11, name: 'P11', memo: false, amount: 999, date: '2026-02-01', partner_id: [200, 'Y'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
      ])
      .mockResolvedValueOnce([])
    mockRead.mockResolvedValueOnce([])
    mockCollectionGet
      .mockResolvedValueOnce({ docs: [] }) // dismissals
      .mockResolvedValueOnce({ docs: [{ id: 'c_10_11', data: () => ({ flaggedBy: 'x', note: 'check' }) }] })

    const { GET } = await import('./route')
    const res = await GET(mkRequest())
    const body = await res.json()
    expect(body.clusters[0].clusterId).toBe('c_10_11')
    expect(body.clusters[0].flagged).toBe(true)
  })

  it('returns 403 si caller sin permiso', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(new AppError('INSUFFICIENT_PERMISSION', 'denied', 403, false))

    const { GET } = await import('./route')
    const res = await GET(mkRequest())
    expect(res.status).toBe(403)
  })

  it('5 GETs concurrentes disparan UN solo searchRead inicial (dedup inflight)', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockSearchRead.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve([
        { id: 1, name: 'P1', memo: false, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
        { id: 2, name: 'P2', memo: false, amount: 5000, date: '2026-01-08', partner_id: [100, 'X'], state: 'paid', journal_id: [13, 'Bank'], x_dup_status: false, x_canonical_payment_id: false },
      ]), 30)),
    ).mockResolvedValue([])
    mockRead.mockResolvedValue([])

    const { GET } = await import('./route')
    const results = await Promise.all([GET(mkRequest()), GET(mkRequest()), GET(mkRequest()), GET(mkRequest()), GET(mkRequest())])
    for (const r of results) expect(r.status).toBe(200)
    // searchRead llamado solo 1 vez para la primera page (la segunda page mock no se ejecuta porque la promesa se comparte y luego cachea)
    expect(mockSearchRead).toHaveBeenCalledTimes(1)
  })
})
