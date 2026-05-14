import { describe, it, expect } from 'vitest'
import {
  paymentAlertSchema,
  createPaymentAlertSchema,
  paymentAlertDocId,
  PAYMENT_ALERT_TYPES,
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
