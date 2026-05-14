import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSearchRead, mockCreate, mockRead } = vi.hoisted(() => ({
  mockSearchRead: vi.fn(),
  mockCreate: vi.fn(),
  mockRead: vi.fn(),
}))

vi.mock('@/lib/odoo/client', () => ({
  getOdooClient: () => ({
    searchRead: mockSearchRead,
    create: mockCreate,
    read: mockRead,
  }),
  OdooClient: class {},
}))

import {
  uploadPaymentReceipt,
  listPaymentReceipts,
  UploadReceiptResultSchema,
} from './payments-attachments'

const sampleBuffer = Buffer.from('fake-image-bytes')
const baseInput = {
  odooPaymentId: 8134,
  receiptBuffer: sampleBuffer,
  fileName: 'comprobante-abc123.jpg',
  mimetype: 'image/jpeg',
}

beforeEach(() => {
  mockSearchRead.mockReset()
  mockCreate.mockReset()
  mockRead.mockReset()
})

describe('uploadPaymentReceipt', () => {
  it('happy path con tagId: documents.document.create con tag_ids + read attachment_id', async () => {
    mockCreate.mockResolvedValueOnce(2019)
    mockRead.mockResolvedValueOnce([{ attachment_id: [45869, 'comprobante-abc123.jpg'] }])

    const result = await uploadPaymentReceipt({ ...baseInput, tagId: 47 })

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const [model, vals] = mockCreate.mock.calls[0] as [string, Record<string, unknown>]
    expect(model).toBe('documents.document')
    expect(vals.res_model).toBe('account.payment')
    expect(vals.res_id).toBe(8134)
    expect(vals.tag_ids).toEqual([[6, 0, [47]]])
    expect(vals.name).toBe('comprobante-abc123.jpg')
    expect(vals.mimetype).toBe('image/jpeg')
    expect(vals.datas).toBe(sampleBuffer.toString('base64'))

    expect(mockRead).toHaveBeenCalledWith('documents.document', [2019], ['attachment_id'])

    expect(() => UploadReceiptResultSchema.parse(result)).not.toThrow()
    expect(result.odooDocumentId).toBe(2019)
    expect(result.odooAttachmentId).toBe(45869)
    expect(result.resModel).toBe('account.payment')
    expect(result.resId).toBe(8134)
    expect(result.tagId).toBe(47)
  })

  it('happy path sin tagId: createVals NO incluye tag_ids y tagId resultado es null', async () => {
    mockCreate.mockResolvedValueOnce(2020)
    mockRead.mockResolvedValueOnce([{ attachment_id: [45870, 'x'] }])

    const result = await uploadPaymentReceipt(baseInput)

    const [, vals] = mockCreate.mock.calls[0] as [string, Record<string, unknown>]
    expect(vals).not.toHaveProperty('tag_ids')
    expect(result.tagId).toBeNull()
  })

  it('read attachment_id falla (no-bloqueante): retorna result con odooAttachmentId=null', async () => {
    mockCreate.mockResolvedValueOnce(2021)
    mockRead.mockRejectedValueOnce(new Error('ACL'))

    const result = await uploadPaymentReceipt(baseInput)

    expect(result.odooDocumentId).toBe(2021)
    expect(result.odooAttachmentId).toBeNull()
  })

  it('read attachment_id retorna false (m2o vacío): odooAttachmentId=null', async () => {
    mockCreate.mockResolvedValueOnce(2022)
    mockRead.mockResolvedValueOnce([{ attachment_id: false }])

    const result = await uploadPaymentReceipt(baseInput)

    expect(result.odooAttachmentId).toBeNull()
  })

  it('2 fallos + 3er intento éxito en create: retorna result sin throw', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(2023)
    mockRead.mockResolvedValueOnce([{ attachment_id: [45871, 'y'] }])

    const result = await uploadPaymentReceipt(baseInput)

    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(result.odooDocumentId).toBe(2023)
  }, 10_000)

  it('4 fallos seguidos → throw AppError ODOO_ATTACHMENT_CREATE_FAILED retryable=true', async () => {
    mockCreate.mockRejectedValue(new Error('Odoo down'))

    await expect(uploadPaymentReceipt(baseInput)).rejects.toMatchObject({
      code: 'ODOO_ATTACHMENT_CREATE_FAILED',
      retryable: true,
    })
    expect(mockCreate).toHaveBeenCalledTimes(4)
    expect(mockRead).not.toHaveBeenCalled()
  }, 15_000)

  it('odooPaymentId=0 → AppError ODOO_ATTACHMENT_INVALID_INPUT inmediato (sin llamar Odoo)', async () => {
    await expect(
      uploadPaymentReceipt({ ...baseInput, odooPaymentId: 0 }),
    ).rejects.toMatchObject({
      code: 'ODOO_ATTACHMENT_INVALID_INPUT',
      retryable: false,
    })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('receiptBuffer vacío → AppError ODOO_ATTACHMENT_INVALID_INPUT', async () => {
    await expect(
      uploadPaymentReceipt({ ...baseInput, receiptBuffer: Buffer.alloc(0) }),
    ).rejects.toMatchObject({
      code: 'ODOO_ATTACHMENT_INVALID_INPUT',
      retryable: false,
    })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('Odoo retorna documentId=false → guard lo detecta y reintenta hasta AppError', async () => {
    mockCreate.mockResolvedValue(false)

    await expect(uploadPaymentReceipt(baseInput)).rejects.toMatchObject({
      code: 'ODOO_ATTACHMENT_CREATE_FAILED',
    })
  }, 15_000)
})

describe('listPaymentReceipts', () => {
  it('payment con 2 documents → retorna array con attachment_id resuelto', async () => {
    const fakeRows = [
      {
        id: 2019,
        name: 'comprobante_a.jpg',
        mimetype: 'image/jpeg',
        file_size: 12345,
        create_date: '2026-05-14 10:00:00',
        attachment_id: [45869, 'comprobante_a.jpg'],
      },
      {
        id: 2020,
        name: 'comprobante_b.pdf',
        mimetype: 'application/pdf',
        file_size: 67890,
        create_date: '2026-05-14 11:00:00',
        attachment_id: false,
      },
    ]
    mockSearchRead.mockResolvedValueOnce(fakeRows)

    const result = await listPaymentReceipts(8134)

    expect(mockSearchRead).toHaveBeenCalledWith(
      'documents.document',
      [
        ['res_model', '=', 'account.payment'],
        ['res_id', '=', 8134],
      ],
      ['id', 'name', 'mimetype', 'file_size', 'create_date', 'attachment_id'],
      { limit: 50 },
    )
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(2019)
    expect(result[0].attachment_id).toBe(45869)
    expect(result[1].name).toBe('comprobante_b.pdf')
    expect(result[1].attachment_id).toBeNull()
  })

  it('payment sin documents → retorna array vacío', async () => {
    mockSearchRead.mockResolvedValueOnce([])

    const result = await listPaymentReceipts(9999)

    expect(result).toEqual([])
  })

  it('odooPaymentId inválido → AppError', async () => {
    await expect(listPaymentReceipts(0)).rejects.toMatchObject({
      code: 'ODOO_ATTACHMENT_INVALID_INPUT',
    })
    expect(mockSearchRead).not.toHaveBeenCalled()
  })
})
