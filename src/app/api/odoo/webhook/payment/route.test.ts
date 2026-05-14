import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

const { mockProcess, mockSet, mockDoc, mockCollection } = vi.hoisted(() => {
  const mockSet = vi.fn().mockResolvedValue(undefined)
  const mockDoc = vi.fn(() => ({ set: mockSet }))
  const mockCollection = vi.fn(() => ({ doc: mockDoc }))
  return { mockProcess: vi.fn(), mockSet, mockDoc, mockCollection }
})

vi.mock('@/lib/odoo/sync/pull-payments', () => ({
  processOdooPayment: mockProcess,
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: mockCollection, doc: vi.fn() },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'TS', increment: (n: number) => n },
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0, toMillis: () => 0 }) },
}))

import { POST } from './route'

const SECRET = 'webhook-secret-test-32-bytes-okok'

function sign(body: string, secret: string = SECRET): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

function makeReq(body: unknown, signature?: string): Request {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request('http://localhost/api/odoo/webhook/payment', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(signature !== undefined ? { 'x-odoo-signature': signature } : {}),
    },
    body: text,
  })
}

const validPayload = {
  id: 8134,
  state: 'paid',
  journal_id: [13, 'Bank'],
  partner_id: [4314, 'Felipe RUBIO'],
  amount: 5000,
  date: '2026-05-12',
  memo: 'Felipe pago',
  write_date: '2026-05-14 12:30:00',
  reconciled_invoice_ids: [],
}

beforeEach(() => {
  mockProcess.mockReset()
  mockSet.mockClear()
  mockDoc.mockClear()
  mockCollection.mockClear()
  process.env.ODOO_WEBHOOK_SECRET = SECRET
  delete process.env.ODOO_WEBHOOK_SECRET_PREV
})

describe('POST /api/odoo/webhook/payment', () => {
  it('401 cuando firma inválida', async () => {
    const res = await POST(makeReq(validPayload, 'aabbcc' /* hex pero no matchea */) as never)
    expect(res.status).toBe(401)
    expect(mockProcess).not.toHaveBeenCalled()
    // syncLog rejected escrito
    expect(mockCollection).toHaveBeenCalledWith('syncLog')
  })

  it('401 cuando header firma ausente', async () => {
    const res = await POST(makeReq(validPayload) as never)
    expect(res.status).toBe(401)
  })

  it('401 cuando no hay secret configurado', async () => {
    delete process.env.ODOO_WEBHOOK_SECRET
    const body = JSON.stringify(validPayload)
    const res = await POST(makeReq(validPayload, sign(body)) as never)
    expect(res.status).toBe(401)
  })

  it('400 cuando JSON malformado pero firma OK', async () => {
    const malformed = '{not json'
    const sig = sign(malformed)
    const res = await POST(makeReq(malformed, sig) as never)
    expect(res.status).toBe(400)
  })

  it('400 cuando payload no matchea schema', async () => {
    const bad = { id: 'not-a-number', state: 'paid' }
    const body = JSON.stringify(bad)
    const res = await POST(makeReq(body, sign(body)) as never)
    expect(res.status).toBe(400)
    expect(mockProcess).not.toHaveBeenCalled()
  })

  it('200 happy path: firma OK + payload válido → procesa', async () => {
    mockProcess.mockResolvedValueOnce({ outcome: 'updated', firestoreId: 'fs1', conflicts: 0, alertCreated: false })
    const body = JSON.stringify(validPayload)
    const res = await POST(makeReq(body, sign(body)) as never)
    expect(res.status).toBe(200)
    expect(mockProcess).toHaveBeenCalledTimes(1)
    const [row, ctx] = mockProcess.mock.calls[0]
    expect(row.id).toBe(8134)
    expect(row.state).toBe('paid')
    expect(ctx.source).toBe('webhook')
    expect(ctx.runId).toMatch(/^webhook-/)
  })

  it('200 incluso si processOdooPayment falla (polling reconcilia)', async () => {
    mockProcess.mockRejectedValueOnce(new Error('boom'))
    const body = JSON.stringify(validPayload)
    const res = await POST(makeReq(body, sign(body)) as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })

  it('rotación: SECRET_PREV válido también', async () => {
    process.env.ODOO_WEBHOOK_SECRET = 'new-secret'
    process.env.ODOO_WEBHOOK_SECRET_PREV = SECRET
    mockProcess.mockResolvedValueOnce({ outcome: 'noop', conflicts: 0, alertCreated: false })
    const body = JSON.stringify(validPayload)
    const res = await POST(makeReq(body, sign(body, SECRET)) as never)
    expect(res.status).toBe(200)
  })
})
