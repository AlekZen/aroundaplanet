import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---- Tipos ----
type MockDoc = { id: string; data: () => Record<string, unknown> }

// ---- Datos de prueba ----
const conflictDocs: MockDoc[] = [
  { id: 'conflict-1', data: () => ({ paymentId: 'pay-1', detectedAt: '2026-05-14T10:00:00Z', resolvedAt: null, resolvedBy: null }) },
  { id: 'conflict-2', data: () => ({ paymentId: 'pay-2', detectedAt: '2026-05-14T09:00:00Z', resolvedAt: null, resolvedBy: null }) },
]

const paymentDocs: MockDoc[] = [
  { id: 'pay-1', data: () => ({ clientName: 'Juan Pérez', amount: 500000, paymentDate: '2026-05-01', status: 'verified', odooState: 'posted', odooSyncStatus: 'synced', odooSyncedAt: '2026-05-14T10:05:00Z', lastError: null, odooPaymentId: 8134 }) },
  { id: 'pay-2', data: () => ({ clientName: 'María López', amount: 145000000, paymentDate: '2026-04-20', status: 'verified', odooState: 'draft', odooSyncStatus: 'synced', odooSyncedAt: '2026-05-14T09:05:00Z', lastError: null, odooPaymentId: 8200 }) },
]

const queueDocs: MockDoc[] = [
  { id: 'pay-err', data: () => ({ clientName: 'Error User', amount: 100000, paymentDate: '2026-05-10', status: 'verified', odooState: null, odooSyncStatus: 'error', odooSyncedAt: null, lastError: 'timeout', odooPaymentId: null, verifiedAt: '2026-05-10T08:00:00Z' }) },
  { id: 'pay-synced', data: () => ({ clientName: 'Ok User', amount: 200000, paymentDate: '2026-05-09', status: 'verified', odooState: 'draft', odooSyncStatus: 'synced', odooSyncedAt: '2026-05-09T12:00:00Z', lastError: null, odooPaymentId: 8300, verifiedAt: '2026-05-09T11:00:00Z' }) },
]

const alertDocs: MockDoc[] = [
  { id: 'pay-3__odoo_canceled', data: () => ({ paymentId: 'pay-3', type: 'odoo_canceled', status: 'dismissed', odooPaymentId: 8400, odooState: 'cancel', firestoreStatus: 'verified', detectedAt: '2026-05-13T15:00:00Z', resolvedAt: '2026-05-13T16:00:00Z', resolvedBy: 'admin-uid' }) },
]

// ---- Stubs mutables ----
let stubSectionDocs: MockDoc[] = conflictDocs
let stubPaymentDocs: MockDoc[] = paymentDocs

vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: vi.fn().mockResolvedValue({ uid: 'admin-uid', roles: ['admin'] }),
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}))

vi.mock('@/lib/firebase/admin', () => {
  const queryGet = vi.fn()
  const paymentGet = vi.fn()

  const makeQuery = (getImpl: ReturnType<typeof vi.fn>) => ({
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: getImpl,
  })

  let callN = 0
  return {
    adminDb: {
      collection: vi.fn((name: string) => {
        callN++
        if (name === 'payments') {
          // Puede ser llamado dos veces: como sección principal (queue) o para enriquecer conflicts
          return makeQuery(paymentGet)
        }
        return makeQuery(queryGet)
      }),
    },
    _queryGet: queryGet,
    _paymentGet: paymentGet,
    _resetCallN: () => { callN = 0 },
  }
})

async function setupMocks() {
  const mod = await import('@/lib/firebase/admin') as unknown as {
    _queryGet: ReturnType<typeof vi.fn>
    _paymentGet: ReturnType<typeof vi.fn>
  }
  mod._queryGet.mockResolvedValue({ docs: stubSectionDocs })
  mod._paymentGet.mockResolvedValue({ docs: stubPaymentDocs })
}

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/payments/sync-console/export')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

describe('GET /api/payments/sync-console/export', () => {
  beforeEach(async () => {
    stubSectionDocs = conflictDocs
    stubPaymentDocs = paymentDocs
    await setupMocks()
  })

  it('section=conflicts&status=open → CSV con header + filas correctas', async () => {
    stubSectionDocs = conflictDocs
    stubPaymentDocs = paymentDocs
    await setupMocks()

    const { GET } = await import('./route')
    const req = makeRequest({ section: 'conflicts', status: 'open' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toMatch(/sync-console-conflicts-\d{4}-\d{2}-\d{2}\.csv/)

    const text = await res.text()
    const lines = text.split('\r\n').filter(Boolean)
    expect(lines.length).toBeGreaterThanOrEqual(1)
    expect(lines[0]).toContain('paymentId')
    expect(lines[0]).toContain('clientName')
  })

  it('section=queue&status=all → CSV incluye todos los status de sync', async () => {
    // queue usa collection('payments') → _paymentGet
    stubSectionDocs = []
    stubPaymentDocs = queueDocs
    await setupMocks()

    const { GET } = await import('./route')
    const req = makeRequest({ section: 'queue', status: 'all' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const text = await res.text()
    const lines = text.split('\r\n').filter(Boolean)
    expect(lines.length).toBe(3) // header + 2 filas
    expect(lines[1]).toContain('error')
    expect(lines[2]).toContain('synced')
  })

  it('section=alerts&status=resolved → CSV con alertas dismissed/resolved', async () => {
    stubSectionDocs = alertDocs
    stubPaymentDocs = []
    await setupMocks()

    const { GET } = await import('./route')
    const req = makeRequest({ section: 'alerts', status: 'resolved' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const text = await res.text()
    const lines = text.split('\r\n').filter(Boolean)
    expect(lines.length).toBe(2) // header + 1 alerta
    expect(lines[1]).toContain('pay-3')
  })

  it('falta section → 400 VALIDATION_ERROR', async () => {
    const { GET } = await import('./route')
    const req = makeRequest({})
    const res = await GET(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe('VALIDATION_ERROR')
  })
})
