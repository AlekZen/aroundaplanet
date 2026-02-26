import { describe, it, expect } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import {
  odooSearchReadSchema,
  odooAmountToCentavos,
  odooDateToTimestamp,
  odooFieldToCamelCase,
  odooFieldsToOdooPrefixed,
} from './odooSchema'

describe('odooSearchReadSchema', () => {
  it('valida input correcto', () => {
    const input = {
      model: 'res.partner',
      domain: [['is_company', '=', true]],
      fields: ['name', 'email'],
      limit: 50,
      offset: 0,
    }
    const result = odooSearchReadSchema.parse(input)
    expect(result.model).toBe('res.partner')
    expect(result.fields).toEqual(['name', 'email'])
    expect(result.limit).toBe(50)
  })

  it('aplica defaults para limit y offset', () => {
    const result = odooSearchReadSchema.parse({
      model: 'res.partner',
      fields: ['name'],
    })
    expect(result.limit).toBe(100)
    expect(result.offset).toBe(0)
    expect(result.domain).toEqual([])
  })

  it('rechaza model vacio', () => {
    expect(() => odooSearchReadSchema.parse({
      model: '',
      fields: ['name'],
    })).toThrow()
  })

  it('rechaza fields vacio', () => {
    expect(() => odooSearchReadSchema.parse({
      model: 'res.partner',
      fields: [],
    })).toThrow()
  })

  it('rechaza limit mayor a 1000', () => {
    expect(() => odooSearchReadSchema.parse({
      model: 'res.partner',
      fields: ['name'],
      limit: 5000,
    })).toThrow()
  })
})

describe('odooAmountToCentavos', () => {
  it('convierte float a centavos (integer)', () => {
    expect(odooAmountToCentavos(145000.50)).toBe(14500050)
  })

  it('maneja numeros enteros', () => {
    expect(odooAmountToCentavos(1000)).toBe(100000)
  })

  it('maneja zero', () => {
    expect(odooAmountToCentavos(0)).toBe(0)
  })

  it('maneja strings numericos', () => {
    expect(odooAmountToCentavos('250.75')).toBe(25075)
  })

  it('retorna 0 para valores no numericos', () => {
    expect(odooAmountToCentavos('abc')).toBe(0)
    expect(odooAmountToCentavos(null)).toBe(0)
    expect(odooAmountToCentavos(undefined)).toBe(0)
  })

  it('redondea correctamente en edge cases de floating point', () => {
    // 0.1 + 0.2 = 0.30000000000000004 en JS
    expect(odooAmountToCentavos(0.1 + 0.2)).toBe(30)
  })
})

describe('odooDateToTimestamp', () => {
  it('convierte fecha Odoo a Firestore Timestamp', () => {
    const result = odooDateToTimestamp('2026-02-26 14:30:00')
    expect(result).toBeInstanceOf(Timestamp)
    const date = result!.toDate()
    expect(date.getUTCFullYear()).toBe(2026)
    expect(date.getUTCMonth()).toBe(1) // February = 1
    expect(date.getUTCDate()).toBe(26)
    expect(date.getUTCHours()).toBe(14)
    expect(date.getUTCMinutes()).toBe(30)
  })

  it('retorna null para string vacio', () => {
    expect(odooDateToTimestamp('')).toBeNull()
  })

  it('retorna null para non-string', () => {
    expect(odooDateToTimestamp(null)).toBeNull()
    expect(odooDateToTimestamp(undefined)).toBeNull()
    expect(odooDateToTimestamp(123)).toBeNull()
  })

  it('retorna null para fecha invalida', () => {
    expect(odooDateToTimestamp('not-a-date')).toBeNull()
  })

  it('maneja fecha sin hora', () => {
    const result = odooDateToTimestamp('2026-03-01 00:00:00')
    expect(result).toBeInstanceOf(Timestamp)
  })
})

describe('odooFieldToCamelCase', () => {
  it('convierte snake_case a camelCase', () => {
    expect(odooFieldToCamelCase('amount_total')).toBe('amountTotal')
    expect(odooFieldToCamelCase('write_date')).toBe('writeDate')
    expect(odooFieldToCamelCase('is_company')).toBe('isCompany')
  })

  it('maneja campos sin underscore', () => {
    expect(odooFieldToCamelCase('name')).toBe('name')
    expect(odooFieldToCamelCase('id')).toBe('id')
  })

  it('maneja multiples underscores', () => {
    expect(odooFieldToCamelCase('partner_invoice_id')).toBe('partnerInvoiceId')
  })
})

describe('odooFieldsToOdooPrefixed', () => {
  it('mapea campos Odoo a nombres Firestore con prefijo odoo', () => {
    const record = { id: 42, write_date: '2026-01-01', amount_total: 1500 }
    const fieldMap = {
      id: 'odooOrderId',
      write_date: 'odooWriteDate',
      amount_total: 'odooAmountTotal',
    }

    const result = odooFieldsToOdooPrefixed(record, fieldMap)
    expect(result).toEqual({
      odooOrderId: 42,
      odooWriteDate: '2026-01-01',
      odooAmountTotal: 1500,
    })
  })

  it('ignora campos que no existen en el record', () => {
    const record = { id: 1 }
    const fieldMap = {
      id: 'odooId',
      missing_field: 'odooMissing',
    }

    const result = odooFieldsToOdooPrefixed(record, fieldMap)
    expect(result).toEqual({ odooId: 1 })
  })
})
