import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPull } = vi.hoisted(() => ({ mockPull: vi.fn() }))

vi.mock('@/lib/odoo/sync/pull-payments', () => ({
  pullOdooPayments: mockPull,
}))

// firebase-admin no se usa directamente acá; pero el módulo de sync lo importa
// transitivamente. Mock para evitar inicializar admin SDK en tests.
vi.mock('@/lib/firebase/admin', () => ({ adminDb: {} }))
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'TS', increment: (n: number) => n },
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0, toMillis: () => 0 }) },
}))
vi.mock('@/lib/odoo/client', () => ({
  getOdooClient: () => ({ searchRead: vi.fn(), create: vi.fn(), write: vi.fn() }),
  OdooClient: class {},
}))

import { POST } from './route'

function makeReq(headers: Record<string, string> = {}, body?: unknown): Request {
  return new Request('http://localhost/api/odoo/sync/pull-payments', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  mockPull.mockReset()
  process.env.ODOO_PULL_SCHEDULER_SECRET = 'super-secret-32-bytes-test-only-ok'
  delete process.env.ODOO_PULL_SCHEDULER_SECRET_PREV
})

describe('POST /api/odoo/sync/pull-payments', () => {
  it('401 si falta header', async () => {
    const res = await POST(makeReq() as never)
    expect(res.status).toBe(401)
  })

  it('401 si secret inválido', async () => {
    const res = await POST(makeReq({ 'x-scheduler-secret': 'wrong' }) as never)
    expect(res.status).toBe(401)
    expect(mockPull).not.toHaveBeenCalled()
  })

  it('200 + summary cuando pullOdooPayments ok', async () => {
    mockPull.mockResolvedValueOnce({
      ok: true,
      runId: 'run-1',
      summary: { fetched: 3, matched: 3, updated: 2, conflicts: 0, alerts: 0, unmatched: 0, validationFailures: 0, durationMs: 100 },
      newCursor: '2026-05-14 12:30:00',
    })
    const res = await POST(makeReq({ 'x-scheduler-secret': 'super-secret-32-bytes-test-only-ok' }) as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.newCursor).toBe('2026-05-14 12:30:00')
  })

  it('503 cuando pullOdooPayments retorna ok:false', async () => {
    mockPull.mockResolvedValueOnce({
      ok: false,
      runId: 'run-2',
      summary: { fetched: 0, matched: 0, updated: 0, conflicts: 0, alerts: 0, unmatched: 0, validationFailures: 0, durationMs: 50 },
      newCursor: null,
      error: 'Odoo timeout',
    })
    const res = await POST(makeReq({ 'x-scheduler-secret': 'super-secret-32-bytes-test-only-ok' }) as never)
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.code).toBe('PULL_FAILED')
    expect(json.retryable).toBe(true)
  })

  it('503 cuando pull throws inesperado', async () => {
    mockPull.mockRejectedValueOnce(new Error('boom'))
    const res = await POST(makeReq({ 'x-scheduler-secret': 'super-secret-32-bytes-test-only-ok' }) as never)
    expect(res.status).toBe(503)
  })

  it('bootstrapFromEpoch true → invoca pull con cursorOverride epoch', async () => {
    mockPull.mockResolvedValueOnce({ ok: true, runId: 'r', summary: { fetched: 0 } as never, newCursor: null })
    await POST(
      makeReq({ 'x-scheduler-secret': 'super-secret-32-bytes-test-only-ok' }, { bootstrapFromEpoch: true }) as never,
    )
    expect(mockPull).toHaveBeenCalledWith({ cursorOverride: '1970-01-01 00:00:00' })
  })

  it('soporta rotación: SECRET_PREV también valida', async () => {
    process.env.ODOO_PULL_SCHEDULER_SECRET = 'new-secret-32b-aaaaaaaaaaaaaaaaaa'
    process.env.ODOO_PULL_SCHEDULER_SECRET_PREV = 'old-secret-32b-bbbbbbbbbbbbbbbbbb'
    mockPull.mockResolvedValueOnce({ ok: true, runId: 'r', summary: {} as never, newCursor: null })
    const res = await POST(
      makeReq({ 'x-scheduler-secret': 'old-secret-32b-bbbbbbbbbbbbbbbbbb' }) as never,
    )
    expect(res.status).toBe(200)
  })
})
