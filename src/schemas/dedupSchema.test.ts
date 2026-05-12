import { describe, it, expect } from 'vitest'
import {
  setCanonicalBodySchema,
  duplicateClusterSchema,
  odooPaymentRowSchema,
} from './dedupSchema'

describe('dedupSchema', () => {
  it('accepts valid setCanonical body', () => {
    const r = setCanonicalBodySchema.safeParse({
      clusterId: 'c_1_2',
      canonicalOdooId: 1,
      memberOdooIds: [1, 2],
    })
    expect(r.success).toBe(true)
  })

  it('rejects setCanonical when canonicalOdooId not in members', () => {
    const r = setCanonicalBodySchema.safeParse({
      clusterId: 'c_1_2',
      canonicalOdooId: 99,
      memberOdooIds: [1, 2],
    })
    expect(r.success).toBe(false)
  })

  it('rejects setCanonical with <2 members', () => {
    const r = setCanonicalBodySchema.safeParse({
      clusterId: 'c_1',
      canonicalOdooId: 1,
      memberOdooIds: [1],
    })
    expect(r.success).toBe(false)
  })

  it('validates a full cluster', () => {
    const member = {
      id: 1, name: 'P1', ref: null, amount: 5000, date: '2026-01-08',
      partnerId: 100, partnerName: 'X', journalId: 13, journalName: 'Bank',
      state: 'paid', xDupStatus: null, xCanonicalPaymentId: null,
    }
    const r = duplicateClusterSchema.safeParse({
      clusterId: 'c_1_2',
      currentState: 'unmarked',
      canonicalId: null,
      members: [member, { ...member, id: 2 }],
    })
    expect(r.success).toBe(true)
  })

  it('accepts xDupStatus canonico/secundario/null', () => {
    const base = {
      id: 1, name: null, ref: null, amount: 100, date: '2026-01-01',
      partnerId: 1, partnerName: 'X', journalId: null, journalName: null,
      state: 'paid', xCanonicalPaymentId: null,
    }
    expect(odooPaymentRowSchema.safeParse({ ...base, xDupStatus: null }).success).toBe(true)
    expect(odooPaymentRowSchema.safeParse({ ...base, xDupStatus: 'canonico' }).success).toBe(true)
    expect(odooPaymentRowSchema.safeParse({ ...base, xDupStatus: 'secundario' }).success).toBe(true)
    expect(odooPaymentRowSchema.safeParse({ ...base, xDupStatus: 'invalid' }).success).toBe(false)
  })
})
