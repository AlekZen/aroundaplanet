import { describe, it, expect, vi, beforeEach } from 'vitest'

// server-only stub
vi.mock('server-only', () => ({}))

// --- Mocks hoisted ---
const {
  mockUpload,
  mockDownload,
  mockSet,
  mockDocGet,
  mockAlertGet,
  mockAlertSet,
} = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockDownload: vi.fn(),
  mockSet: vi.fn(),
  mockDocGet: vi.fn(),
  mockAlertGet: vi.fn(),
  mockAlertSet: vi.fn(),
}))

vi.mock('@/lib/firebase/admin', () => {
  const paymentDoc = { set: mockSet }
  const configDoc = { get: mockDocGet }
  const alertDoc = { get: mockAlertGet, set: mockAlertSet }
  return {
    adminDb: {
      collection: (name: string) => ({
        doc: (_id: string) => {
          if (name === 'appConfig') return configDoc
          if (name === 'paymentAlerts') return alertDoc
          // payments
          return paymentDoc
        },
      }),
    },
  }
})

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => '__SERVER_TS__',
    increment: (n: number) => ({ __increment: n }),
    arrayUnion: (...vals: unknown[]) => ({ __arrayUnion: vals }),
  },
}))

vi.mock('@/lib/odoo/payments-attachments', () => ({
  uploadPaymentReceipt: mockUpload,
}))

vi.mock('@/lib/storage/download-receipt', () => ({
  downloadReceiptFromUrl: mockDownload,
}))

import {
  syncReceiptToOdoo,
  getReceiptTagId,
  resetReceiptTagCache,
} from './receipt-attachment'
import { AppError } from '@/lib/errors/AppError'

beforeEach(() => {
  mockUpload.mockReset()
  mockDownload.mockReset()
  mockSet.mockReset()
  mockDocGet.mockReset()
  mockAlertGet.mockReset()
  mockAlertSet.mockReset()
  resetReceiptTagCache()
})

describe('getReceiptTagId', () => {
  it('lee appConfig/odoo y devuelve tagId numérico', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ attachmentReceiptTagId: 47 }),
    })
    const tagId = await getReceiptTagId()
    expect(tagId).toBe(47)
  })

  it('cache: segunda llamada NO golpea Firestore otra vez', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ attachmentReceiptTagId: 47 }),
    })
    await getReceiptTagId()
    await getReceiptTagId()
    expect(mockDocGet).toHaveBeenCalledTimes(1)
  })

  it('doc no existe → null', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false })
    const tagId = await getReceiptTagId()
    expect(tagId).toBeNull()
  })

  it('valor no numérico → null', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ attachmentReceiptTagId: 'foo' }),
    })
    const tagId = await getReceiptTagId()
    expect(tagId).toBeNull()
  })

  it('read falla → null (silencioso)', async () => {
    mockDocGet.mockRejectedValueOnce(new Error('Firestore down'))
    const tagId = await getReceiptTagId()
    expect(tagId).toBeNull()
  })
})

describe('syncReceiptToOdoo', () => {
  const baseInput = {
    firestoreId: 'abc123',
    odooPaymentId: 8134,
    receiptUrl: 'https://firebasestorage.googleapis.com/v0/b/bucket/o/receipts%2Frec.pdf?alt=media&token=xyz',
  }

  it('happy path: download + upload + persiste mirror synced', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ attachmentReceiptTagId: 47 }),
    })
    mockDownload.mockResolvedValueOnce({
      buffer: Buffer.from('pdf-bytes'),
      mimetype: 'application/pdf',
      fileName: 'comprobante-abc123.pdf',
    })
    mockUpload.mockResolvedValueOnce({
      odooDocumentId: 2019,
      odooAttachmentId: 45869,
      resModel: 'account.payment',
      resId: 8134,
      fileName: 'comprobante-abc123.pdf',
      mimetype: 'application/pdf',
      uploadedAt: new Date().toISOString(),
      tagId: 47,
    })
    mockAlertGet.mockResolvedValueOnce({ exists: false })

    const result = await syncReceiptToOdoo(baseInput)

    expect(result.status).toBe('synced')
    expect(result.odooDocumentId).toBe(2019)
    expect(result.odooAttachmentId).toBe(45869)

    expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({
      odooPaymentId: 8134,
      tagId: 47,
      fileName: 'comprobante-abc123.pdf',
    }))

    // Verifica que el mirror persistió con shape correcto
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        odooDocumentId: 2019,
        odooAttachmentSyncStatus: 'synced',
        odooAttachmentLastError: null,
        attachmentRetryCount: 0,
      }),
      { merge: true },
    )
  })

  it('receiptUrl null → skipped_no_receipt sin llamar download/upload', async () => {
    const result = await syncReceiptToOdoo({ ...baseInput, receiptUrl: null })

    expect(result.status).toBe('skipped_no_receipt')
    expect(mockDownload).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ odooAttachmentSyncStatus: 'skipped_no_receipt' }),
      { merge: true },
    )
  })

  it('download falla con RECEIPT_NOT_FOUND → error mirror + alerta reason=receipt_missing', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ attachmentReceiptTagId: 47 }),
    })
    mockDownload.mockRejectedValueOnce(
      new AppError('RECEIPT_NOT_FOUND', 'archivo borrado', 404, false),
    )

    const result = await syncReceiptToOdoo(baseInput)

    expect(result.status).toBe('error')
    expect(result.reason).toBe('receipt_missing')
    expect(result.retryable).toBe(false)
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        odooAttachmentSyncStatus: 'error',
        attachmentRetryCount: expect.objectContaining({ __increment: 1 }),
      }),
      { merge: true },
    )
    expect(mockAlertSet).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'abc123',
        type: 'attachment_failed',
        status: 'open',
        reason: 'receipt_missing',
      }),
      { merge: true },
    )
  })

  it('upload falla con ODOO_ATTACHMENT_CREATE_FAILED → alerta reason=upload_failed retryable=true', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ attachmentReceiptTagId: 47 }),
    })
    mockDownload.mockResolvedValueOnce({
      buffer: Buffer.from('x'),
      mimetype: 'application/pdf',
      fileName: 'comprobante-abc123.pdf',
    })
    mockUpload.mockRejectedValueOnce(
      new AppError('ODOO_ATTACHMENT_CREATE_FAILED', 'Odoo timeout', 502, true),
    )

    const result = await syncReceiptToOdoo(baseInput)

    expect(result.status).toBe('error')
    expect(result.reason).toBe('upload_failed')
    expect(result.retryable).toBe(true)
  })

  it('tagId no configurado (null) → upload sin tag, sigue funcionando', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false })
    mockDownload.mockResolvedValueOnce({
      buffer: Buffer.from('x'),
      mimetype: 'application/pdf',
      fileName: 'comprobante-abc123.pdf',
    })
    mockUpload.mockResolvedValueOnce({
      odooDocumentId: 2020,
      odooAttachmentId: null,
      resModel: 'account.payment',
      resId: 8134,
      fileName: 'comprobante-abc123.pdf',
      mimetype: 'application/pdf',
      uploadedAt: new Date().toISOString(),
      tagId: null,
    })
    mockAlertGet.mockResolvedValueOnce({ exists: false })

    const result = await syncReceiptToOdoo(baseInput)

    expect(result.status).toBe('synced')
    expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({ tagId: null }))
  })

  it('auto-resolve alerta previa cuando upload tiene éxito', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ attachmentReceiptTagId: 47 }),
    })
    mockDownload.mockResolvedValueOnce({
      buffer: Buffer.from('x'),
      mimetype: 'application/pdf',
      fileName: 'comprobante-abc123.pdf',
    })
    mockUpload.mockResolvedValueOnce({
      odooDocumentId: 2021,
      odooAttachmentId: 45870,
      resModel: 'account.payment',
      resId: 8134,
      fileName: 'comprobante-abc123.pdf',
      mimetype: 'application/pdf',
      uploadedAt: new Date().toISOString(),
      tagId: 47,
    })
    mockAlertGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'open' }),
    })

    await syncReceiptToOdoo(baseInput)

    expect(mockAlertSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'resolved',
        resolvedBy: 'system_auto_retry',
      }),
      { merge: true },
    )
  })

  it('no throw aunque la persistencia del mirror falle', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ attachmentReceiptTagId: 47 }),
    })
    mockDownload.mockResolvedValueOnce({
      buffer: Buffer.from('x'),
      mimetype: 'application/pdf',
      fileName: 'comprobante-abc123.pdf',
    })
    mockUpload.mockResolvedValueOnce({
      odooDocumentId: 2022,
      odooAttachmentId: 45871,
      resModel: 'account.payment',
      resId: 8134,
      fileName: 'comprobante-abc123.pdf',
      mimetype: 'application/pdf',
      uploadedAt: new Date().toISOString(),
      tagId: 47,
    })
    mockSet.mockRejectedValue(new Error('Firestore down'))

    // No throw — captura interna
    const result = await syncReceiptToOdoo(baseInput)
    expect(result.status).toBe('synced')
  })
})
