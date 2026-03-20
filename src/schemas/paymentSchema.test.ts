import { describe, it, expect } from 'vitest'
import {
  createPaymentSchema,
  verifyPaymentSchema,
  paymentListQuerySchema,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from './paymentSchema'

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
})
