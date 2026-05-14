import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ----------------------------------------------------------------
// Mocks hoisted
// ----------------------------------------------------------------
const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockRunTransaction = vi.fn()
const mockUpdate = vi.fn()
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    runTransaction: (...a: unknown[]) => mockRunTransaction(...a),
    collection: (_col: string) => ({
      doc: (_id: string) => ({ update: (...a: unknown[]) => mockUpdate(...a) }),
    }),
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

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
const makeContext = (conflictId: string) => ({ params: Promise.resolve({ conflictId }) })

const makeReq = (body: unknown) =>
  new NextRequest('http://localhost/api/payment-conflicts/c1/resolve', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

/** Construye un mock de transacción que devuelve snaps controlados. */
function buildTxMock(
  conflictData: Record<string, unknown> | null,
  paymentData: Record<string, unknown> | null,
) {
  return async (fn: (tx: unknown) => Promise<void>) => {
    const txSet = vi.fn()
    const txUpdate = vi.fn()
    const txGet = vi.fn()
      .mockResolvedValueOnce(
        conflictData
          ? { exists: true, data: () => conflictData }
          : { exists: false },
      )
      .mockResolvedValueOnce(
        paymentData
          ? { exists: true, data: () => paymentData }
          : { exists: false },
      )

    await fn({ get: txGet, set: txSet, update: txUpdate })
    return { txSet, txUpdate }
  }
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------
describe('PATCH /api/payment-conflicts/[conflictId]/resolve', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset().mockResolvedValue({ uid: 'admin-1' })
    mockRunTransaction.mockReset()
    mockUpdate.mockReset()
    mockSync.mockReset()
  })

  it('AC8-1 firestore-wins: actualiza lww + resuelve; memo skippea push (sin mapeo top-level)', async () => {
    const conflictData = {
      paymentId: 'pay1',
      field: 'memo',
      firestoreValue: 'valor FS',
      odooValue: 'valor Odoo',
      firestoreWrittenAt: { seconds: 2000, nanoseconds: 0 },
      odooWrittenAt: { seconds: 1000, nanoseconds: 0 },
      resolvedAt: null,
    }
    const paymentData = { status: 'verified', odooSyncStatus: 'error' }

    let capturedTxSet: ReturnType<typeof vi.fn> | undefined
    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const txSet = vi.fn()
      const txUpdate = vi.fn()
      const txGet = vi.fn()
        .mockResolvedValueOnce({ exists: true, data: () => conflictData })
        .mockResolvedValueOnce({ exists: true, data: () => paymentData })
      capturedTxSet = txSet
      await fn({ get: txGet, set: txSet, update: txUpdate })
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(makeReq({ resolution: 'firestore' }), makeContext('c1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.resolved).toBe(true)
    // memo no tiene mapeo top-level → push skipeado, resolución sí persiste en lww
    expect(mockSync).not.toHaveBeenCalled()
    expect(capturedTxSet).toHaveBeenCalled()
  })

  it('AC8-2 odoo-wins: invoca push; push ok → 200 pushQueued:false', async () => {
    const conflictData = {
      paymentId: 'pay1',
      field: 'amount',
      firestoreValue: 500_000,
      odooValue: 600_000,
      firestoreWrittenAt: { seconds: 1000, nanoseconds: 0 },
      odooWrittenAt: { seconds: 2000, nanoseconds: 0 },
      resolvedAt: null,
    }
    const paymentData = { status: 'verified', amountCents: 500_000, odooSyncStatus: 'error' }

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const txGet = vi.fn()
        .mockResolvedValueOnce({ exists: true, data: () => conflictData })
        .mockResolvedValueOnce({ exists: true, data: () => paymentData })
      await fn({ get: txGet, set: vi.fn(), update: vi.fn() })
    })
    mockSync.mockResolvedValue({ status: 'synced', odooPaymentId: 9000, isNew: false })

    const { PATCH } = await import('./route')
    const res = await PATCH(makeReq({ resolution: 'odoo' }), makeContext('c1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.resolved).toBe(true)
    expect(body.pushQueued).toBe(false)
    expect(mockSync).toHaveBeenCalled()
  })

  it('AC8-3 odoo-wins + push falla → conflict resuelto + 200 pushQueued:true', async () => {
    const conflictData = {
      paymentId: 'pay1',
      field: 'amount',
      firestoreValue: 500_000,
      odooValue: 600_000,
      firestoreWrittenAt: { seconds: 1000, nanoseconds: 0 },
      odooWrittenAt: { seconds: 2000, nanoseconds: 0 },
      resolvedAt: null,
    }
    const paymentData = { status: 'verified', odooSyncStatus: 'error' }

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const txGet = vi.fn()
        .mockResolvedValueOnce({ exists: true, data: () => conflictData })
        .mockResolvedValueOnce({ exists: true, data: () => paymentData })
      await fn({ get: txGet, set: vi.fn(), update: vi.fn() })
    })
    mockSync.mockRejectedValue(new Error('Odoo timeout'))
    mockUpdate.mockResolvedValue(undefined)

    const { PATCH } = await import('./route')
    const res = await PATCH(makeReq({ resolution: 'odoo' }), makeContext('c1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.resolved).toBe(true)
    expect(body.pushQueued).toBe(true)
  })

  it('AC8-4 custom con resolutionValue malformado (amount string) → 400', async () => {
    const conflictData = {
      paymentId: 'pay1',
      field: 'amount',
      firestoreValue: 500_000,
      odooValue: 600_000,
      firestoreWrittenAt: { seconds: 1000, nanoseconds: 0 },
      odooWrittenAt: { seconds: 2000, nanoseconds: 0 },
      resolvedAt: null,
    }
    const paymentData = { status: 'verified' }

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const txGet = vi.fn()
        .mockResolvedValueOnce({ exists: true, data: () => conflictData })
        .mockResolvedValueOnce({ exists: true, data: () => paymentData })
      await fn({ get: txGet, set: vi.fn(), update: vi.fn() })
    })

    const { PATCH } = await import('./route')
    // amount como string → tipo inválido
    const res = await PATCH(
      makeReq({ resolution: 'custom', resolutionValue: 'no-es-numero' }),
      makeContext('c1'),
    )

    expect(res.status).toBe(400)
  })

  // ----------------------------------------------------------------
  // Fix #1 — snapshot fresco con valor ganador mapeado correctamente
  // ----------------------------------------------------------------

  it('Fix1-a odoo-wins amount: syncVerifiedPaymentToOdoo recibe amountCents=odooValue (NO firestoreValue)', async () => {
    const conflictData = {
      paymentId: 'pay1',
      field: 'amount',
      firestoreValue: 500_000,
      odooValue: 600_000,
      firestoreWrittenAt: { seconds: 1000, nanoseconds: 0 },
      odooWrittenAt: { seconds: 2000, nanoseconds: 0 },
      resolvedAt: null,
    }
    const paymentData = { status: 'verified', amountCents: 500_000, odooSyncStatus: 'synced' }

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const txGet = vi.fn()
        .mockResolvedValueOnce({ exists: true, data: () => conflictData })
        .mockResolvedValueOnce({ exists: true, data: () => paymentData })
      await fn({ get: txGet, set: vi.fn(), update: vi.fn() })
    })
    mockSync.mockResolvedValue({ status: 'synced', odooPaymentId: 9000, isNew: false })

    const { PATCH } = await import('./route')
    await PATCH(makeReq({ resolution: 'odoo' }), makeContext('c1'))

    expect(mockSync).toHaveBeenCalledOnce()
    const [, docArg] = mockSync.mock.calls[0] as [string, Record<string, unknown>]
    // Debe recibir el valor ganador (odooValue=600_000), NO el viejo firestoreValue=500_000
    expect(docArg.amountCents).toBe(600_000)
  })

  it('Fix1-b custom paymentDate: syncVerifiedPaymentToOdoo recibe date=resolutionValue', async () => {
    const conflictData = {
      paymentId: 'pay1',
      field: 'paymentDate',
      firestoreValue: '2026-01-01',
      odooValue: '2026-02-01',
      firestoreWrittenAt: { seconds: 1000, nanoseconds: 0 },
      odooWrittenAt: { seconds: 2000, nanoseconds: 0 },
      resolvedAt: null,
    }
    const paymentData = { status: 'verified', date: '2026-01-01', odooSyncStatus: 'synced' }

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const txGet = vi.fn()
        .mockResolvedValueOnce({ exists: true, data: () => conflictData })
        .mockResolvedValueOnce({ exists: true, data: () => paymentData })
      await fn({ get: txGet, set: vi.fn(), update: vi.fn() })
    })
    mockSync.mockResolvedValue({ status: 'synced', odooPaymentId: 9001, isNew: false })

    const { PATCH } = await import('./route')
    await PATCH(makeReq({ resolution: 'custom', resolutionValue: '2026-03-15' }), makeContext('c1'))

    expect(mockSync).toHaveBeenCalledOnce()
    const [, docArg] = mockSync.mock.calls[0] as [string, Record<string, unknown>]
    // Campo mapeado a 'date'; valor personalizado
    expect(docArg.date).toBe('2026-03-15')
  })

  // ----------------------------------------------------------------
  // Fix #3 — shouldPush con timestamps 0/0
  // ----------------------------------------------------------------

  it('Fix3 firestore-wins + timestamps ausentes: push SÍ se invoca (decisión explícita admin)', async () => {
    const conflictData = {
      paymentId: 'pay1',
      field: 'amount',
      firestoreValue: 500_000,
      odooValue: 600_000,
      // sin firestoreWrittenAt / odooWrittenAt → toEpochMs retorna 0
      resolvedAt: null,
    }
    const paymentData = { status: 'verified', amountCents: 500_000, odooSyncStatus: 'error' }

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const txGet = vi.fn()
        .mockResolvedValueOnce({ exists: true, data: () => conflictData })
        .mockResolvedValueOnce({ exists: true, data: () => paymentData })
      await fn({ get: txGet, set: vi.fn(), update: vi.fn() })
    })
    mockSync.mockResolvedValue({ status: 'synced', odooPaymentId: 9002, isNew: false })

    const { PATCH } = await import('./route')
    const res = await PATCH(makeReq({ resolution: 'firestore' }), makeContext('c1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.resolved).toBe(true)
    // timestamps ausentes → 0 === 0 → push SÍ debe invocarse
    expect(mockSync).toHaveBeenCalledOnce()
    const [, docArg] = mockSync.mock.calls[0] as [string, Record<string, unknown>]
    expect(docArg.amountCents).toBe(500_000) // valor ganador firestoreValue
  })

  it('AC8-5 race: resolvedAt ya existe → 409', async () => {
    const conflictData = {
      paymentId: 'pay1',
      field: 'memo',
      firestoreValue: 'a',
      odooValue: 'b',
      firestoreWrittenAt: { seconds: 1000, nanoseconds: 0 },
      odooWrittenAt: { seconds: 2000, nanoseconds: 0 },
      resolvedAt: new Date(),
      resolvedBy: 'other-admin',
    }

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const txGet = vi.fn().mockResolvedValueOnce({ exists: true, data: () => conflictData })
      await fn({ get: txGet, set: vi.fn(), update: vi.fn() })
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(makeReq({ resolution: 'odoo' }), makeContext('c1'))

    expect(res.status).toBe(409)
  })
})
