import { describe, it, expect } from 'vitest'
import {
  reconciliationConfirmBodySchema,
  reconciliationRejectBodySchema,
  reconciliationCandidateSchema,
} from './reconciliationSchema'

describe('reconciliationSchema', () => {
  it('accepts valid confirm body', () => {
    const r = reconciliationConfirmBodySchema.safeParse({
      odooPaymentId: 7976,
      confidence: 'high',
      notes: 'match perfecto',
    })
    expect(r.success).toBe(true)
  })

  it('rejects confirm body with invalid odooPaymentId', () => {
    const r = reconciliationConfirmBodySchema.safeParse({
      odooPaymentId: -1,
      confidence: 'high',
    })
    expect(r.success).toBe(false)
  })

  it('rejects confirm body with invalid confidence', () => {
    const r = reconciliationConfirmBodySchema.safeParse({
      odooPaymentId: 1,
      confidence: 'invalid',
    })
    expect(r.success).toBe(false)
  })

  it('accepts valid reject body', () => {
    const r = reconciliationRejectBodySchema.safeParse({
      odooPaymentId: 1,
      reason: 'cliente distinto',
    })
    expect(r.success).toBe(true)
  })

  it('rejects reject body without reason', () => {
    const r = reconciliationRejectBodySchema.safeParse({
      odooPaymentId: 1,
      reason: '',
    })
    expect(r.success).toBe(false)
  })

  it('validates a full candidate', () => {
    const c = {
      firestoreId: 'abc',
      firestorePayment: {
        firestoreId: 'abc',
        partnerName: 'X',
        clientName: 'X',
        agentName: 'A',
        amount: 5000,
        amountCents: 500000,
        paymentDate: '2026-01-08',
        paymentMethod: 'transfer',
        orderId: 'ord1',
        warnings: [],
      },
      odooId: 7976,
      odooPayment: {
        odooId: 7976,
        partnerId: 4314,
        partnerName: 'X',
        amount: 5000,
        date: '2026-01-08',
        journalId: 13,
        journalName: 'Bank',
        state: 'paid',
        ref: null,
      },
      diff: { amountDiff: 0, dateDiff: 0, partnerJaccard: 1 },
      confidence: 'high' as const,
      reasons: ['partner✓'],
      warnings: [],
    }
    const r = reconciliationCandidateSchema.safeParse(c)
    expect(r.success).toBe(true)
  })
})
