import { describe, it, expect } from 'vitest'
import { odooWebhookPaymentSchema, unpackMany2One } from './odooWebhookPaymentSchema'

describe('odooWebhookPaymentSchema', () => {
  const base = {
    id: 8134,
    state: 'draft',
    journal_id: [13, 'Bank'] as [number, string],
    partner_id: [4314, 'Felipe RUBIO'] as [number, string],
    amount: 5000,
    date: '2026-05-12',
    write_date: '2026-05-14 12:00:00',
    reconciled_invoice_ids: [],
  }

  it('valida payload típico Odoo', () => {
    expect(odooWebhookPaymentSchema.safeParse(base).success).toBe(true)
  })

  it('acepta many2one como id desnudo', () => {
    expect(
      odooWebhookPaymentSchema.safeParse({ ...base, journal_id: 13, partner_id: 4314 }).success,
    ).toBe(true)
  })

  it('acepta x_firebase_payment_id y memo opcionales', () => {
    const parsed = odooWebhookPaymentSchema.parse({
      ...base,
      memo: 'TEST_AROUNDA — Felipe',
      x_firebase_payment_id: 'Uu4UppB4AFvM1AHYKixb',
    })
    expect(parsed.memo).toBe('TEST_AROUNDA — Felipe')
    expect(parsed.x_firebase_payment_id).toBe('Uu4UppB4AFvM1AHYKixb')
  })

  it('rechaza si falta id', () => {
    const { id: _id, ...rest } = base
    void _id
    expect(odooWebhookPaymentSchema.safeParse(rest).success).toBe(false)
  })

  it('rechaza state vacío', () => {
    expect(odooWebhookPaymentSchema.safeParse({ ...base, state: '' }).success).toBe(false)
  })
})

describe('unpackMany2One', () => {
  it('tuple → {id, name}', () => {
    expect(unpackMany2One([13, 'Bank'])).toEqual({ id: 13, name: 'Bank' })
  })
  it('id desnudo → {id, name: null}', () => {
    expect(unpackMany2One(13)).toEqual({ id: 13, name: null })
  })
  it('null → {id: null, name: null}', () => {
    expect(unpackMany2One(null)).toEqual({ id: null, name: null })
  })
})
