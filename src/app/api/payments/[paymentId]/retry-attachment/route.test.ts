import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockGet = vi.fn()
const mockSet = vi.fn()
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ get: mockGet, set: mockSet }) }),
  },
}))

const mockListReceipts = vi.fn()
vi.mock('@/lib/odoo/payments-attachments', () => ({
  listPaymentReceipts: (...a: unknown[]) => mockListReceipts(...a),
}))

const mockSyncReceipt = vi.fn()
vi.mock('@/lib/odoo/sync/receipt-attachment', () => ({
  syncReceiptToOdoo: (...a: unknown[]) => mockSyncReceipt(...a),
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

const makeContext = (paymentId: string) => ({ params: Promise.resolve({ paymentId }) })

function makeReq(body?: object) {
  return new NextRequest('http://localhost/api/payments/abc/retry-attachment', {
    method: 'POST',
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }
      : {}),
  })
}

beforeEach(() => {
  mockRequirePermission.mockReset().mockResolvedValue({ uid: 'admin-1' })
  mockGet.mockReset()
  mockSet.mockReset().mockResolvedValue(undefined)
  mockListReceipts.mockReset()
  mockSyncReceipt.mockReset()
})

describe('POST /api/payments/[paymentId]/retry-attachment', () => {
  const baseData = {
    odooPaymentId: 8134,
    odooSyncStatus: 'synced',
    receiptUrl: 'https://firebasestorage.googleapis.com/v0/b/bucket/o/r.pdf?token=x',
    attachmentRetryCount: 0,
    odooAttachmentSyncStatus: 'error',
  }

  it('404 si pago no existe', async () => {
    mockGet.mockResolvedValue({ exists: false })
    const { POST } = await import('./route')
    const res = await POST(makeReq(), makeContext('abc'))
    expect(res.status).toBe(404)
  })

  it('400 si pago sin odooPaymentId (no fue pusheado)', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...baseData, odooPaymentId: null }),
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(), makeContext('abc'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('PAYMENT_NOT_PUSHED')
  })

  it('400 si odooSyncStatus="pending"', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...baseData, odooSyncStatus: 'pending' }),
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(), makeContext('abc'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('PAYMENT_NOT_SYNCED')
  })

  it('429 si attachmentRetryCount >= 5', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...baseData, attachmentRetryCount: 5 }),
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(), makeContext('abc'))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('RATE_LIMITED')
  })

  it('400 si receiptUrl missing', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...baseData, receiptUrl: null }),
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(), makeContext('abc'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('RECEIPT_URL_MISSING')
  })

  it('idempotencia: documento existente con prefijo canónico → 200 alreadyExists', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => baseData,
    })
    mockListReceipts.mockResolvedValueOnce([
      {
        id: 2019,
        name: 'comprobante-abc.pdf',
        mimetype: 'application/pdf',
        file_size: 1000,
        create_date: '2026-05-14',
        attachment_id: 45869,
      },
    ])
    const { POST } = await import('./route')
    const res = await POST(makeReq(), makeContext('abc'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.alreadyExists).toBe(true)
    expect(body.odooDocumentId).toBe(2019)
    expect(body.odooAttachmentId).toBe(45869)
    expect(mockSyncReceipt).not.toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        odooDocumentId: 2019,
        odooAttachmentSyncStatus: 'synced',
      }),
      { merge: true },
    )
  })

  it('no existe documento canónico → llama syncReceiptToOdoo y retorna éxito', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => baseData,
    })
    mockListReceipts.mockResolvedValueOnce([
      {
        id: 999,
        name: 'otro.pdf',
        mimetype: 'application/pdf',
        file_size: 500,
        create_date: '2026-05-14',
        attachment_id: 99999,
      },
    ])
    mockSyncReceipt.mockResolvedValueOnce({
      status: 'synced',
      odooDocumentId: 2020,
      odooAttachmentId: 45870,
    })

    const { POST } = await import('./route')
    const res = await POST(makeReq(), makeContext('abc'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alreadyExists).toBe(false)
    expect(body.odooDocumentId).toBe(2020)
    expect(mockSyncReceipt).toHaveBeenCalledWith({
      firestoreId: 'abc',
      odooPaymentId: 8134,
      receiptUrl: baseData.receiptUrl,
    })
  })

  it('syncReceipt retorna error → 502 con reason', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => baseData,
    })
    mockListReceipts.mockResolvedValueOnce([])
    mockSyncReceipt.mockResolvedValueOnce({
      status: 'error',
      reason: 'upload_failed',
      error: 'Odoo timeout',
      retryable: true,
    })

    const { POST } = await import('./route')
    const res = await POST(makeReq(), makeContext('abc'))
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('upload_failed')
    expect(body.error).toBe('Odoo timeout')
  })

  it('listPaymentReceipts falla → log y sigue con upload (no bloquea)', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => baseData,
    })
    mockListReceipts.mockRejectedValueOnce(new Error('Odoo down'))
    mockSyncReceipt.mockResolvedValueOnce({
      status: 'synced',
      odooDocumentId: 2021,
      odooAttachmentId: 45871,
    })

    const { POST } = await import('./route')
    const res = await POST(makeReq(), makeContext('abc'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.odooDocumentId).toBe(2021)
  })

  it('legacy_linked sin force → 409 LEGACY_LINKED_REQUIRES_FORCE', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...baseData, odooSyncStatus: 'legacy_linked' }),
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(), makeContext('abc'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('LEGACY_LINKED_REQUIRES_FORCE')
    expect(mockSyncReceipt).not.toHaveBeenCalled()
  })

  it('legacy_linked con force=true → permite retry', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...baseData, odooSyncStatus: 'legacy_linked' }),
    })
    mockListReceipts.mockResolvedValueOnce([])
    mockSyncReceipt.mockResolvedValueOnce({
      status: 'synced',
      odooDocumentId: 2022,
      odooAttachmentId: 45872,
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq({ force: true }), makeContext('abc'))
    expect(res.status).toBe(200)
    expect(mockSyncReceipt).toHaveBeenCalled()
  })
})
