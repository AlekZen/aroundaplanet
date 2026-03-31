import { describe, it, expect } from 'vitest'
import {
  createOrderSchema,
  orderStatusSchema,
  ORDER_STATUSES,
  VALID_TRANSITIONS,
  PHONE_COUNTRY_CODES,
  DEFAULT_COUNTRY_CODE,
} from './orderSchema'

const VALID_ORDER = {
  tripId: 'trip-123',
  departureId: 'dep-456',
  contactName: 'Juan Perez',
  contactPhone: '+523411234567',
}

describe('orderSchema', () => {
  describe('createOrderSchema', () => {
    it('accepts valid order data', () => {
      const result = createOrderSchema.safeParse(VALID_ORDER)
      expect(result.success).toBe(true)
    })

    it('accepts valid data with attribution fields', () => {
      const result = createOrderSchema.safeParse({
        ...VALID_ORDER,
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'summer2026',
        agentId: 'agent-789',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing tripId', () => {
      const result = createOrderSchema.safeParse({
        departureId: 'dep-456',
        contactName: 'Juan',
        contactPhone: '+523411234567',
      })
      expect(result.success).toBe(false)
    })

    it('accepts missing departureId (optional for agent enrollments)', () => {
      const result = createOrderSchema.safeParse({
        tripId: 'trip-123',
        contactName: 'Juan',
        contactPhone: '+523411234567',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty tripId', () => {
      const result = createOrderSchema.safeParse({
        ...VALID_ORDER,
        tripId: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty departureId', () => {
      const result = createOrderSchema.safeParse({
        ...VALID_ORDER,
        departureId: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing contactName', () => {
      const { contactName: _, ...withoutName } = VALID_ORDER
      const result = createOrderSchema.safeParse(withoutName)
      expect(result.success).toBe(false)
    })

    it('rejects contactName shorter than 2 characters', () => {
      const result = createOrderSchema.safeParse({
        ...VALID_ORDER,
        contactName: 'A',
      })
      expect(result.success).toBe(false)
    })

    it('accepts missing contactPhone (optional for authenticated enrollments)', () => {
      const { contactPhone: _, ...withoutPhone } = VALID_ORDER
      const result = createOrderSchema.safeParse(withoutPhone)
      expect(result.success).toBe(true)
    })

    it('accepts contactPhone of any length when provided', () => {
      const result = createOrderSchema.safeParse({
        ...VALID_ORDER,
        contactPhone: '+52123456',
      })
      expect(result.success).toBe(true)
    })

    it('rejects agentId longer than 128 characters', () => {
      const result = createOrderSchema.safeParse({
        ...VALID_ORDER,
        agentId: 'a'.repeat(129),
      })
      expect(result.success).toBe(false)
    })
  })

  describe('PHONE_COUNTRY_CODES', () => {
    it('has Mexico as first entry', () => {
      expect(PHONE_COUNTRY_CODES[0].country).toBe('Mexico')
      expect(PHONE_COUNTRY_CODES[0].code).toBe('+52')
    })

    it('has Spain as second entry', () => {
      expect(PHONE_COUNTRY_CODES[1].country).toBe('Espana')
      expect(PHONE_COUNTRY_CODES[1].code).toBe('+34')
    })

    it('has at least 15 Spanish-speaking countries', () => {
      expect(PHONE_COUNTRY_CODES.length).toBeGreaterThanOrEqual(15)
    })

    it('defaults to Mexico country code', () => {
      expect(DEFAULT_COUNTRY_CODE).toBe('+52')
    })
  })

  describe('orderStatusSchema', () => {
    it('accepts all valid statuses', () => {
      for (const status of ORDER_STATUSES) {
        const result = orderStatusSchema.safeParse(status)
        expect(result.success).toBe(true)
      }
    })

    it('rejects invalid status', () => {
      const result = orderStatusSchema.safeParse('InvalidStatus')
      expect(result.success).toBe(false)
    })
  })

  describe('ORDER_STATUSES', () => {
    it('contains exactly 5 statuses', () => {
      expect(ORDER_STATUSES).toHaveLength(5)
    })

    it('includes all expected statuses', () => {
      expect(ORDER_STATUSES).toContain('Interesado')
      expect(ORDER_STATUSES).toContain('Confirmado')
      expect(ORDER_STATUSES).toContain('En Progreso')
      expect(ORDER_STATUSES).toContain('Completado')
      expect(ORDER_STATUSES).toContain('Cancelado')
    })
  })

  describe('VALID_TRANSITIONS', () => {
    it('allows Interesado to transition to Confirmado or Cancelado', () => {
      expect(VALID_TRANSITIONS['Interesado']).toContain('Confirmado')
      expect(VALID_TRANSITIONS['Interesado']).toContain('Cancelado')
      expect(VALID_TRANSITIONS['Interesado']).toHaveLength(2)
    })

    it('allows Confirmado to transition to En Progreso or Cancelado', () => {
      expect(VALID_TRANSITIONS['Confirmado']).toContain('En Progreso')
      expect(VALID_TRANSITIONS['Confirmado']).toContain('Cancelado')
      expect(VALID_TRANSITIONS['Confirmado']).toHaveLength(2)
    })

    it('allows En Progreso to transition only to Completado', () => {
      expect(VALID_TRANSITIONS['En Progreso']).toContain('Completado')
      expect(VALID_TRANSITIONS['En Progreso']).toHaveLength(1)
    })

    it('does not allow transitions from Completado', () => {
      expect(VALID_TRANSITIONS['Completado']).toHaveLength(0)
    })

    it('does not allow transitions from Cancelado', () => {
      expect(VALID_TRANSITIONS['Cancelado']).toHaveLength(0)
    })

    it('has entries for all statuses', () => {
      for (const status of ORDER_STATUSES) {
        expect(VALID_TRANSITIONS).toHaveProperty(status)
      }
    })
  })
})
