import { describe, it, expect } from 'vitest'
import {
  paymentAlertSchema,
  createPaymentAlertSchema,
  paymentAlertDocId,
  PAYMENT_ALERT_TYPES,
  attachmentFailedReasonSchema,
  ATTACHMENT_FAILED_REASONS,
} from './paymentAlertSchema'

describe('paymentAlertSchema', () => {
  const base = {
    paymentId: 'pay1',
    type: 'odoo_canceled' as const,
    status: 'open' as const,
    detectedAt: '2026-05-14T12:00:00Z',
  }

  it('valida un alert mínimo válido', () => {
    expect(paymentAlertSchema.safeParse(base).success).toBe(true)
  })

  it('default status = open', () => {
    const { status: _omit, ...rest } = base
    void _omit
    const parsed = paymentAlertSchema.parse(rest)
    expect(parsed.status).toBe('open')
  })

  it('rechaza paymentId vacío', () => {
    expect(paymentAlertSchema.safeParse({ ...base, paymentId: '' }).success).toBe(false)
  })

  it('rechaza type desconocido', () => {
    expect(
      paymentAlertSchema.safeParse({ ...base, type: 'foo' as never }).success,
    ).toBe(false)
  })

  it('acepta los 4 types de PAYMENT_ALERT_TYPES', () => {
    for (const t of PAYMENT_ALERT_TYPES) {
      expect(paymentAlertSchema.safeParse({ ...base, type: t }).success).toBe(true)
    }
  })
})

describe('createPaymentAlertSchema', () => {
  it('omite campos de resolución', () => {
    const parsed = createPaymentAlertSchema.parse({
      paymentId: 'pay1',
      type: 'odoo_canceled',
      detectedAt: '2026-05-14T12:00:00Z',
      runId: 'run-1',
    })
    expect('resolvedAt' in parsed).toBe(false)
    expect('resolvedBy' in parsed).toBe(false)
  })
})

describe('paymentAlertDocId', () => {
  it('genera id idempotente paymentId__type', () => {
    expect(paymentAlertDocId('pay1', 'odoo_canceled')).toBe('pay1__odoo_canceled')
  })
})

// Story 9.4 — razones tipificadas de attachment_failed
describe('attachmentFailedReasonSchema', () => {
  it('acepta todas las razones del enum ATTACHMENT_FAILED_REASONS', () => {
    for (const reason of ATTACHMENT_FAILED_REASONS) {
      expect(attachmentFailedReasonSchema.safeParse(reason).success).toBe(true)
    }
  })

  it('rechaza razón fuera del enum', () => {
    expect(attachmentFailedReasonSchema.safeParse('bad_reason').success).toBe(false)
    expect(attachmentFailedReasonSchema.safeParse('').success).toBe(false)
  })
})

describe('paymentAlertSchema con campos attachment_failed (Story 9.4)', () => {
  const baseAttachment = {
    paymentId: 'pay-abc',
    type: 'attachment_failed' as const,
    detectedAt: '2026-05-14T10:00:00Z',
  }

  it('acepta type=attachment_failed con reason=upload_failed', () => {
    const result = paymentAlertSchema.safeParse({
      ...baseAttachment,
      reason: 'upload_failed',
      errorMessage: 'HTTP 500 desde Odoo al crear ir.attachment',
    })
    expect(result.success).toBe(true)
  })

  it('acepta type=attachment_failed con reason=receipt_missing', () => {
    const result = paymentAlertSchema.safeParse({
      ...baseAttachment,
      reason: 'receipt_missing',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza reason fuera del enum', () => {
    const result = paymentAlertSchema.safeParse({
      ...baseAttachment,
      reason: 'network_error',
    })
    expect(result.success).toBe(false)
  })

  it('acepta reason=null (campo opcional)', () => {
    const result = paymentAlertSchema.safeParse({
      ...baseAttachment,
      reason: null,
    })
    expect(result.success).toBe(true)
  })
})

describe('createPaymentAlertSchema con campos attachment_failed (Story 9.4)', () => {
  it('incluye reason y errorMessage en el schema de creación', () => {
    const parsed = createPaymentAlertSchema.parse({
      paymentId: 'pay-xyz',
      type: 'attachment_failed',
      detectedAt: '2026-05-14T10:00:00Z',
      reason: 'tag_unavailable',
      errorMessage: 'Tag aroundaplanet_comprobante no encontrado en Odoo',
    })
    expect(parsed.reason).toBe('tag_unavailable')
    expect(parsed.errorMessage).toBe('Tag aroundaplanet_comprobante no encontrado en Odoo')
  })
})
