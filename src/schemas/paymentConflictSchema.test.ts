import { describe, it, expect } from 'vitest'
import {
  paymentConflictSchema,
  createPaymentConflictSchema,
  resolvePaymentConflictSchema,
  CONFLICT_RESOLUTIONS,
  conflictResolutionSchema,
} from './paymentConflictSchema'

describe('paymentConflictSchema', () => {
  const baseConflict = {
    paymentId: 'fs_pmt_001',
    field: 'amount' as const,
    firestoreValue: 14500000,
    odooValue: 14400000,
    firestoreWrittenAt: '2026-05-12T10:00:00.000Z',
    odooWrittenAt: '2026-05-12T10:05:00.000Z',
    detectedAt: '2026-05-12T10:15:00.000Z',
  }

  it('parses a valid open conflict on amount', () => {
    expect(paymentConflictSchema.safeParse(baseConflict).success).toBe(true)
  })

  it('parses a valid open conflict on memo (different value types)', () => {
    const result = paymentConflictSchema.safeParse({
      ...baseConflict,
      field: 'memo',
      firestoreValue: 'Abono 1',
      odooValue: 'Pago primer abono',
    })
    expect(result.success).toBe(true)
  })

  it('parses a valid open conflict on paymentDate', () => {
    const result = paymentConflictSchema.safeParse({
      ...baseConflict,
      field: 'paymentDate',
      firestoreValue: new Date('2026-05-10'),
      odooValue: new Date('2026-05-11'),
    })
    expect(result.success).toBe(true)
  })

  it('parses a resolved conflict', () => {
    const result = paymentConflictSchema.safeParse({
      ...baseConflict,
      resolvedAt: '2026-05-12T11:00:00.000Z',
      resolvedBy: 'admin_uid_123',
      resolution: 'firestore',
      resolutionValue: 14500000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown field', () => {
    const result = paymentConflictSchema.safeParse({
      ...baseConflict,
      field: 'status',
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown resolution', () => {
    const result = paymentConflictSchema.safeParse({
      ...baseConflict,
      resolution: 'discard',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing paymentId', () => {
    const result = paymentConflictSchema.safeParse({
      ...baseConflict,
      paymentId: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('createPaymentConflictSchema', () => {
  it('omits detectedAt and resolution fields', () => {
    const result = createPaymentConflictSchema.safeParse({
      paymentId: 'fs_pmt_001',
      field: 'memo',
      firestoreValue: 'a',
      odooValue: 'b',
      firestoreWrittenAt: '2026-05-12T10:00:00.000Z',
      odooWrittenAt: '2026-05-12T10:01:00.000Z',
      firestoreSource: 'firestore',
      odooSource: 'odoo',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing required field', () => {
    const result = createPaymentConflictSchema.safeParse({
      paymentId: 'fs_pmt_001',
      // field missing
      firestoreValue: 'a',
      odooValue: 'b',
      firestoreWrittenAt: '2026-05-12T10:00:00.000Z',
      odooWrittenAt: '2026-05-12T10:01:00.000Z',
    })
    expect(result.success).toBe(false)
  })
})

describe('resolvePaymentConflictSchema', () => {
  it('accepts firestore resolution sin resolutionValue', () => {
    const result = resolvePaymentConflictSchema.safeParse({
      resolution: 'firestore',
    })
    expect(result.success).toBe(true)
  })

  it('accepts odoo resolution sin resolutionValue', () => {
    const result = resolvePaymentConflictSchema.safeParse({
      resolution: 'odoo',
    })
    expect(result.success).toBe(true)
  })

  it('rejects custom resolution sin resolutionValue', () => {
    const result = resolvePaymentConflictSchema.safeParse({
      resolution: 'custom',
    })
    expect(result.success).toBe(false)
  })

  it('accepts custom resolution con resolutionValue', () => {
    const result = resolvePaymentConflictSchema.safeParse({
      resolution: 'custom',
      resolutionValue: 14450000,
      resolutionNote: 'Promedio entre ambos',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown resolution', () => {
    const result = resolvePaymentConflictSchema.safeParse({
      resolution: 'merge',
    })
    expect(result.success).toBe(false)
  })
})

describe('CONFLICT_RESOLUTIONS', () => {
  it('exposes firestore, odoo y custom', () => {
    expect(CONFLICT_RESOLUTIONS).toEqual(['firestore', 'odoo', 'custom'])
  })

  it('conflictResolutionSchema acepta cada valor', () => {
    for (const r of CONFLICT_RESOLUTIONS) {
      expect(conflictResolutionSchema.safeParse(r).success).toBe(true)
    }
  })
})
