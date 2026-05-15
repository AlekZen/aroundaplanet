import { describe, it, expect } from 'vitest'
import { currencyToSpanish, formatMxnFromCents } from './currencyToSpanish'

describe('currencyToSpanish', () => {
  it('cubre los montos reales de las plantillas piloto', () => {
    // VAM: $115,000
    expect(currencyToSpanish(11500000)).toBe('CIENTO QUINCE MIL PESOS 00/100 M.N.')
    // ASIA: $86,600
    expect(currencyToSpanish(8660000)).toBe('OCHENTA Y SEIS MIL SEISCIENTOS PESOS 00/100 M.N.')
    // CHEPE: $17,500
    expect(currencyToSpanish(1750000)).toBe('DIECISIETE MIL QUINIENTOS PESOS 00/100 M.N.')
    // Anticipo VAM: $20,000
    expect(currencyToSpanish(2000000)).toBe('VEINTE MIL PESOS 00/100 M.N.')
    // Anticipo CHEPE: $4,000
    expect(currencyToSpanish(400000)).toBe('CUATRO MIL PESOS 00/100 M.N.')
  })

  it('maneja 0 y centavos', () => {
    expect(currencyToSpanish(0)).toBe('CERO PESOS 00/100 M.N.')
    expect(currencyToSpanish(100)).toBe('UNO PESO 00/100 M.N.')
    expect(currencyToSpanish(12345)).toBe('CIENTO VEINTITRÉS PESOS 45/100 M.N.')
  })

  it('maneja millones', () => {
    expect(currencyToSpanish(100000000)).toBe('UN MILLÓN PESOS 00/100 M.N.')
    expect(currencyToSpanish(150000000)).toBe('UN MILLÓN QUINIENTOS MIL PESOS 00/100 M.N.')
  })

  it('redondea a centavos con padStart', () => {
    expect(currencyToSpanish(11500050)).toBe('CIENTO QUINCE MIL PESOS 50/100 M.N.')
    expect(currencyToSpanish(11500005)).toBe('CIENTO QUINCE MIL PESOS 05/100 M.N.')
  })

  it('rechaza valores inválidos', () => {
    expect(() => currencyToSpanish(-100)).toThrow()
    expect(() => currencyToSpanish(1.5)).toThrow()
    expect(() => currencyToSpanish(NaN)).toThrow()
  })
})

describe('formatMxnFromCents', () => {
  it('formatea con separador de miles y 2 decimales', () => {
    expect(formatMxnFromCents(14500000)).toBe('$145,000.00 MXN')
    expect(formatMxnFromCents(11500000)).toBe('$115,000.00 MXN')
    expect(formatMxnFromCents(1750000)).toBe('$17,500.00 MXN')
    expect(formatMxnFromCents(0)).toBe('$0.00 MXN')
    expect(formatMxnFromCents(99)).toBe('$0.99 MXN')
  })
})
