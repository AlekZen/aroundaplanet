import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---- Stubs mutables ----
let stubAlertData: Record<string, unknown> = { type: 'odoo_canceled', status: 'open' }
let stubAlertExists = true
let stubPaymentExists = true
let getCallIdx = 0

const stubTransaction = vi.fn()

vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: vi.fn().mockResolvedValue({ uid: 'admin-uid', roles: ['admin'] }),
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}))

vi.mock('@/lib/firebase/admin', () => {
  const docGet = vi.fn()
  const collection = vi.fn(() => ({ doc: vi.fn(() => ({ get: docGet })) }))
  const runTransaction = vi.fn()

  // Vamos a reusar las mismas fn pero hacerlas llegar a las vars mutables
  return {
    adminDb: { collection, runTransaction },
    // Exponer para poder configurar en tests
    _docGet: docGet,
    _runTransaction: runTransaction,
  }
})

// Helper que reconfigura el mock tras el import
async function setupAdminDb() {
  const mod = await import('@/lib/firebase/admin') as unknown as {
    adminDb: { collection: ReturnType<typeof vi.fn>; runTransaction: ReturnType<typeof vi.fn> }
    _docGet: ReturnType<typeof vi.fn>
    _runTransaction: ReturnType<typeof vi.fn>
  }

  getCallIdx = 0
  mod._docGet.mockImplementation(() => {
    getCallIdx++
    if (getCallIdx === 1) return Promise.resolve({ exists: stubAlertExists, data: () => stubAlertData })
    return Promise.resolve({ exists: stubPaymentExists, data: () => ({ status: 'verified' }) })
  })

  mod._runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    await fn({ update: vi.fn(), set: vi.fn() })
  })
  stubTransaction.mockImplementation(mod._runTransaction as (...args: unknown[]) => unknown)
}

function makeRequest(body: unknown, paymentId = 'pay-123') {
  return new NextRequest(`http://localhost/api/payments/${paymentId}/mark-canceled`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeContext(paymentId = 'pay-123') {
  return { params: Promise.resolve({ paymentId }) }
}

describe('POST /api/payments/[paymentId]/mark-canceled', () => {
  beforeEach(async () => {
    stubAlertData = { type: 'odoo_canceled', status: 'open' }
    stubAlertExists = true
    stubPaymentExists = true
    await setupAdminDb()
  })

  it('happy path: setea rejected + resuelve alerta + crea log', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({ alertId: 'alert-abc', note: 'cliente canceló' })
    const res = await POST(req, makeContext())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ markedCanceled: true })
  })

  it('alerta no es odoo_canceled → 400 invalid_alert', async () => {
    stubAlertData = { type: 'attachment_failed', status: 'open' }
    await setupAdminDb()

    const { POST } = await import('./route')
    const req = makeRequest({ alertId: 'alert-wrong-type' })
    const res = await POST(req, makeContext())
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.code).toBe('invalid_alert')
  })

  it('body sin alertId → 400 VALIDATION_ERROR', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({ note: 'sin alertId' })
    const res = await POST(req, makeContext())
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
  })
})
