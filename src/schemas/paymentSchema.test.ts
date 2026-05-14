import { describe, it, expect } from 'vitest'
import {
  createPaymentSchema,
  verifyPaymentSchema,
  paymentListQuerySchema,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  paymentOdooSyncSchema,
  odooPaymentStateSchema,
  odooSyncStatusSchema,
  paymentLwwFieldsSchema,
  lwwValueSchema,
  PAYMENT_FIELD_OWNERSHIP,
  LWW_PAYMENT_FIELDS,
  isLwwField,
  getFieldOwnership,
  ODOO_PAYMENT_STATES,
  ODOO_SYNC_STATUSES,
} from './paymentSchema'
import { z } from 'zod'

describe('paymentSchema', () => {
  describe('createPaymentSchema', () => {
    it('validates a correct payment', () => {
      const result = createPaymentSchema.safeParse({
        orderId: 'order123',
        amountCents: 14500000,
        paymentMethod: 'transfer',
        date: '2026-03-20',
      })
      expect(result.success).toBe(true)
    })

    it('accepts optional notes', () => {
      const result = createPaymentSchema.safeParse({
        orderId: 'order123',
        amountCents: 5000,
        paymentMethod: 'card',
        date: '2026-03-20',
        notes: 'Pago parcial primer abono',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty orderId', () => {
      const result = createPaymentSchema.safeParse({
        orderId: '',
        amountCents: 5000,
        paymentMethod: 'transfer',
        date: '2026-03-20',
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative amountCents', () => {
      const result = createPaymentSchema.safeParse({
        orderId: 'order123',
        amountCents: -100,
        paymentMethod: 'transfer',
        date: '2026-03-20',
      })
      expect(result.success).toBe(false)
    })

    it('rejects zero amountCents', () => {
      const result = createPaymentSchema.safeParse({
        orderId: 'order123',
        amountCents: 0,
        paymentMethod: 'transfer',
        date: '2026-03-20',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid payment method', () => {
      const result = createPaymentSchema.safeParse({
        orderId: 'order123',
        amountCents: 5000,
        paymentMethod: 'bitcoin',
        date: '2026-03-20',
      })
      expect(result.success).toBe(false)
    })

    it('accepts all valid payment methods', () => {
      for (const method of PAYMENT_METHODS) {
        const result = createPaymentSchema.safeParse({
          orderId: 'order123',
          amountCents: 5000,
          paymentMethod: method,
          date: '2026-03-20',
        })
        expect(result.success).toBe(true)
      }
    })

    it('rejects float amountCents', () => {
      const result = createPaymentSchema.safeParse({
        orderId: 'order123',
        amountCents: 5000.50,
        paymentMethod: 'transfer',
        date: '2026-03-20',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('verifyPaymentSchema', () => {
    it('validates verify action without note', () => {
      const result = verifyPaymentSchema.safeParse({ action: 'verify' })
      expect(result.success).toBe(true)
    })

    it('validates reject action with note', () => {
      const result = verifyPaymentSchema.safeParse({
        action: 'reject',
        rejectionNote: 'Monto incorrecto en el comprobante',
      })
      expect(result.success).toBe(true)
    })

    it('rejects reject action without note', () => {
      const result = verifyPaymentSchema.safeParse({ action: 'reject' })
      expect(result.success).toBe(false)
    })

    it('rejects reject action with short note', () => {
      const result = verifyPaymentSchema.safeParse({
        action: 'reject',
        rejectionNote: 'No',
      })
      expect(result.success).toBe(false)
    })

    it('validates request_info action', () => {
      const result = verifyPaymentSchema.safeParse({
        action: 'request_info',
        rejectionNote: 'Necesito ver el comprobante completo',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid action', () => {
      const result = verifyPaymentSchema.safeParse({ action: 'delete' })
      expect(result.success).toBe(false)
    })
  })

  describe('paymentListQuerySchema', () => {
    it('accepts empty params with defaults', () => {
      const result = paymentListQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.pageSize).toBe(20)
      }
    })

    it('accepts valid status filter', () => {
      for (const status of PAYMENT_STATUSES) {
        const result = paymentListQuerySchema.safeParse({ status })
        expect(result.success).toBe(true)
      }
    })

    it('rejects invalid status', () => {
      const result = paymentListQuerySchema.safeParse({ status: 'invalid' })
      expect(result.success).toBe(false)
    })

    it('coerces pageSize string to number', () => {
      const result = paymentListQuerySchema.safeParse({ pageSize: '10' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.pageSize).toBe(10)
      }
    })
  })

  describe('constants', () => {
    it('has labels for all statuses', () => {
      for (const status of PAYMENT_STATUSES) {
        expect(PAYMENT_STATUS_LABELS[status]).toBeDefined()
      }
    })

    it('has labels for all methods', () => {
      for (const method of PAYMENT_METHODS) {
        expect(PAYMENT_METHOD_LABELS[method]).toBeDefined()
      }
    })
  })

  // ===================================================================
  // Epic 9 — Sync bidireccional Firestore↔Odoo
  // ===================================================================

  describe('odooPaymentStateSchema', () => {
    it('accepts every documented Odoo state', () => {
      for (const state of ODOO_PAYMENT_STATES) {
        expect(odooPaymentStateSchema.safeParse(state).success).toBe(true)
      }
    })

    it('rejects unknown state values', () => {
      expect(odooPaymentStateSchema.safeParse('posted').success).toBe(false)
      expect(odooPaymentStateSchema.safeParse('').success).toBe(false)
    })
  })

  describe('odooSyncStatusSchema', () => {
    it('accepts every sync status', () => {
      for (const status of ODOO_SYNC_STATUSES) {
        expect(odooSyncStatusSchema.safeParse(status).success).toBe(true)
      }
    })

    it('includes legacy_linked and orphan states', () => {
      expect(ODOO_SYNC_STATUSES).toContain('legacy_linked')
      expect(ODOO_SYNC_STATUSES).toContain('orphan')
    })

    it('rejects arbitrary strings', () => {
      expect(odooSyncStatusSchema.safeParse('done').success).toBe(false)
    })
  })

  describe('lwwValueSchema — Firestore Timestamp compat', () => {
    it('acepta writtenAt como shape Firestore Timestamp ({seconds, nanoseconds})', () => {
      const schema = lwwValueSchema(z.string())
      const result = schema.safeParse({
        value: 'memo',
        writtenAt: { seconds: 1715000000, nanoseconds: 123_000_000 },
        source: 'odoo',
      })
      expect(result.success).toBe(true)
    })

    it('acepta un Firestore Timestamp con métodos extras (passthrough)', () => {
      const schema = lwwValueSchema(z.string())
      const fakeTimestamp = {
        seconds: 1715000000,
        nanoseconds: 0,
        toDate: () => new Date(),
        toMillis: () => 1715000000000,
      }
      const result = schema.safeParse({
        value: 'memo',
        writtenAt: fakeTimestamp,
        source: 'odoo',
      })
      expect(result.success).toBe(true)
    })

    it('rechaza Timestamp shape con nanoseconds fuera de rango', () => {
      const schema = lwwValueSchema(z.string())
      const result = schema.safeParse({
        value: 'memo',
        writtenAt: { seconds: 1, nanoseconds: 1_000_000_000 },
        source: 'odoo',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('lwwValueSchema', () => {
    it('parses a valid LWW number with ISO writtenAt', () => {
      const schema = lwwValueSchema(z.number().int())
      const result = schema.safeParse({
        value: 14500000,
        writtenAt: '2026-05-12T10:00:00.000Z',
        source: 'firestore',
      })
      expect(result.success).toBe(true)
    })

    it('parses a valid LWW number with Date writtenAt', () => {
      const schema = lwwValueSchema(z.number().int())
      const result = schema.safeParse({
        value: 100,
        writtenAt: new Date(),
        source: 'odoo',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid source', () => {
      const schema = lwwValueSchema(z.string())
      const result = schema.safeParse({
        value: 'memo',
        writtenAt: '2026-05-12T10:00:00.000Z',
        source: 'unknown',
      })
      expect(result.success).toBe(false)
    })

    it('rejects value of wrong inner type', () => {
      const schema = lwwValueSchema(z.number().int())
      const result = schema.safeParse({
        value: 'not-a-number',
        writtenAt: '2026-05-12T10:00:00.000Z',
        source: 'firestore',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('paymentLwwFieldsSchema', () => {
    it('parses a complete LWW block with int amount in centavos', () => {
      const result = paymentLwwFieldsSchema.safeParse({
        amount: { value: 14500000, writtenAt: new Date(), source: 'firestore' },
        paymentDate: { value: '2026-05-12', writtenAt: new Date(), source: 'firestore' },
        memo: { value: 'Abono 1', writtenAt: new Date(), source: 'odoo' },
      })
      expect(result.success).toBe(true)
    })

    it('rejects float amount (debe ser centavos enteros)', () => {
      const result = paymentLwwFieldsSchema.safeParse({
        amount: { value: 100.5, writtenAt: new Date(), source: 'firestore' },
        paymentDate: { value: '2026-05-12', writtenAt: new Date(), source: 'firestore' },
        memo: { value: 'x', writtenAt: new Date(), source: 'firestore' },
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative amount', () => {
      const result = paymentLwwFieldsSchema.safeParse({
        amount: { value: -1, writtenAt: new Date(), source: 'firestore' },
        paymentDate: { value: '2026-05-12', writtenAt: new Date(), source: 'firestore' },
        memo: { value: 'x', writtenAt: new Date(), source: 'firestore' },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('paymentOdooSyncSchema', () => {
    it('accepts an empty object (todos opcional para back-compat)', () => {
      const result = paymentOdooSyncSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('parses a fully-populated synced payment', () => {
      const result = paymentOdooSyncSchema.safeParse({
        odooPaymentId: 12345,
        odooState: 'paid',
        odooJournalId: 7,
        odooJournalName: 'Bank MXN',
        odooReconciled: true,
        odooReconciledInvoiceIds: [501, 502],
        odooCanceledAt: null,
        odooFolderId: 88,
        odooFolderName: 'ASIA MAYO 2026',
        odooDocumentId: 999,
        odooAttachmentIds: [10, 11],
        isCanonicalDuplicate: false,
        canonicalPaymentOdooId: null,
        odooSyncStatus: 'synced',
        odooSyncedAt: '2026-05-12T10:00:00.000Z',
        odooLastError: null,
        syncRetryCount: 0,
        linkedAt: null,
        linkedBy: null,
        linkMatchConfidence: 'high',
      })
      expect(result.success).toBe(true)
    })

    it('accepts a legacy-linked payment sin ir.model.data', () => {
      const result = paymentOdooSyncSchema.safeParse({
        odooPaymentId: 42,
        odooSyncStatus: 'legacy_linked',
        linkedAt: new Date(),
        linkedBy: 'admin_uid',
        linkMatchConfidence: 'high',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid odooState', () => {
      const result = paymentOdooSyncSchema.safeParse({ odooState: 'posted' })
      expect(result.success).toBe(false)
    })

    it('rejects negative odooPaymentId', () => {
      const result = paymentOdooSyncSchema.safeParse({ odooPaymentId: -1 })
      expect(result.success).toBe(false)
    })

    it('rejects non-integer Odoo IDs', () => {
      const result = paymentOdooSyncSchema.safeParse({ odooPaymentId: 1.5 })
      expect(result.success).toBe(false)
    })

    it('rejects invalid linkMatchConfidence', () => {
      const result = paymentOdooSyncSchema.safeParse({
        linkMatchConfidence: 'maybe',
      })
      expect(result.success).toBe(false)
    })

    it('accepts partial lww block', () => {
      const result = paymentOdooSyncSchema.safeParse({
        lww: {
          memo: { value: 'note', writtenAt: new Date(), source: 'odoo' },
        },
      })
      expect(result.success).toBe(true)
    })

    // Refines de coherencia (Code review fix R2)
    it('rechaza odooSyncStatus=synced sin odooPaymentId', () => {
      const result = paymentOdooSyncSchema.safeParse({
        odooSyncStatus: 'synced',
        odooPaymentId: null,
      })
      expect(result.success).toBe(false)
    })

    it('acepta odooSyncStatus=synced con odooPaymentId presente', () => {
      const result = paymentOdooSyncSchema.safeParse({
        odooSyncStatus: 'synced',
        odooPaymentId: 999,
      })
      expect(result.success).toBe(true)
    })

    it('rechaza odooSyncStatus=legacy_linked sin linkedAt', () => {
      const result = paymentOdooSyncSchema.safeParse({
        odooSyncStatus: 'legacy_linked',
        odooPaymentId: 42,
        linkedAt: null,
      })
      expect(result.success).toBe(false)
    })

    it('rechaza odooSyncStatus=error sin odooLastError', () => {
      const result = paymentOdooSyncSchema.safeParse({
        odooSyncStatus: 'error',
        odooLastError: null,
      })
      expect(result.success).toBe(false)
    })

    it('acepta odooSyncStatus=error con odooLastError', () => {
      const result = paymentOdooSyncSchema.safeParse({
        odooSyncStatus: 'error',
        odooLastError: 'Odoo XML-RPC timeout',
      })
      expect(result.success).toBe(true)
    })

    it('rechaza odooReconciled=true con odooReconciledInvoiceIds vacío', () => {
      const result = paymentOdooSyncSchema.safeParse({
        odooReconciled: true,
        odooReconciledInvoiceIds: [],
      })
      expect(result.success).toBe(false)
    })

    it('acepta odooReconciled=true con al menos un invoiceId', () => {
      const result = paymentOdooSyncSchema.safeParse({
        odooReconciled: true,
        odooReconciledInvoiceIds: [501],
      })
      expect(result.success).toBe(true)
    })

    it('acepta odooReconciled=false sin invoiceIds', () => {
      const result = paymentOdooSyncSchema.safeParse({
        odooReconciled: false,
      })
      expect(result.success).toBe(true)
    })

    // Story 9.6 F1 — dismissed refine
    it('acepta odooSyncStatus=dismissed con odooSyncDismissedReason válida', () => {
      const result = paymentOdooSyncSchema.safeParse({
        odooSyncStatus: 'dismissed',
        odooSyncDismissedReason: 'Pago duplicado confirmado',
        odooSyncDismissedBy: 'paloma@aroundaplanet.com',
        odooSyncDismissedAt: new Date(),
      })
      expect(result.success).toBe(true)
    })

    it('rechaza odooSyncStatus=dismissed sin odooSyncDismissedReason (o < 5 chars)', () => {
      const sinReason = paymentOdooSyncSchema.safeParse({
        odooSyncStatus: 'dismissed',
      })
      expect(sinReason.success).toBe(false)
      expect(
        sinReason.error?.issues.some((i) => i.path.includes('odooSyncDismissedReason')),
      ).toBe(true)

      const corta = paymentOdooSyncSchema.safeParse({
        odooSyncStatus: 'dismissed',
        odooSyncDismissedReason: 'ok',
      })
      expect(corta.success).toBe(false)
      expect(
        corta.error?.issues.some((i) => i.path.includes('odooSyncDismissedReason')),
      ).toBe(true)
    })
  })

  describe('PAYMENT_FIELD_OWNERSHIP matrix', () => {
    it('marks core Firestore-only fields as firestore-owned', () => {
      expect(PAYMENT_FIELD_OWNERSHIP.status).toBe('firestore')
      expect(PAYMENT_FIELD_OWNERSHIP.agentId).toBe('firestore')
      expect(PAYMENT_FIELD_OWNERSHIP.receiptUrl).toBe('firestore')
      expect(PAYMENT_FIELD_OWNERSHIP.ocrData).toBe('firestore')
      expect(PAYMENT_FIELD_OWNERSHIP.verifiedBy).toBe('firestore')
    })

    it('marks accounting fields as Odoo-owned', () => {
      expect(PAYMENT_FIELD_OWNERSHIP.odooState).toBe('odoo')
      expect(PAYMENT_FIELD_OWNERSHIP.odooJournalId).toBe('odoo')
      expect(PAYMENT_FIELD_OWNERSHIP.odooReconciled).toBe('odoo')
    })

    it('marks amount, memo and paymentDate as LWW', () => {
      expect(PAYMENT_FIELD_OWNERSHIP.amount).toBe('lww')
      expect(PAYMENT_FIELD_OWNERSHIP.memo).toBe('lww')
      expect(PAYMENT_FIELD_OWNERSHIP.paymentDate).toBe('lww')
    })

    it('marks identity/sync metadata as bridge', () => {
      expect(PAYMENT_FIELD_OWNERSHIP.odooPaymentId).toBe('bridge')
      expect(PAYMENT_FIELD_OWNERSHIP.odooSyncStatus).toBe('bridge')
      expect(PAYMENT_FIELD_OWNERSHIP.linkedAt).toBe('bridge')
    })

    it('only lists exactly the three LWW fields', () => {
      const lwwEntries = Object.entries(PAYMENT_FIELD_OWNERSHIP).filter(
        ([, ownership]) => ownership === 'lww',
      )
      expect(lwwEntries).toHaveLength(3)
      expect(lwwEntries.map(([k]) => k).sort()).toEqual(
        [...LWW_PAYMENT_FIELDS].sort(),
      )
    })
  })

  describe('isLwwField helper', () => {
    it('returns true for the three LWW fields', () => {
      expect(isLwwField('amount')).toBe(true)
      expect(isLwwField('memo')).toBe(true)
      expect(isLwwField('paymentDate')).toBe(true)
    })

    it('returns false for non-LWW fields', () => {
      expect(isLwwField('status')).toBe(false)
      expect(isLwwField('odooState')).toBe(false)
      expect(isLwwField('unknown')).toBe(false)
    })
  })

  describe('getFieldOwnership helper', () => {
    it('returns the matrix value for known fields', () => {
      expect(getFieldOwnership('amount')).toBe('lww')
      expect(getFieldOwnership('odooState')).toBe('odoo')
      expect(getFieldOwnership('status')).toBe('firestore')
      expect(getFieldOwnership('odooPaymentId')).toBe('bridge')
    })

    it('returns undefined for unknown fields', () => {
      expect(getFieldOwnership('foo')).toBeUndefined()
    })
  })
})
