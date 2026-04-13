import { describe, it, expect } from 'vitest'
import { cotizacionSchema } from './cotizacionSchema'

const validData = {
  nombreAgente: 'María López',
  nombreCliente: 'Juan Pérez García',
  tipoViaje: 'Internacional' as const,
  destino: 'Cancún, México',
  fechaSalida: '2026-05-15',
  fechaRegreso: '2026-05-22',
  adultos: '2',
  menores: '0',
  habitaciones: '1',
  presupuesto: '$25K-$50K' as const,
}

describe('cotizacionSchema', () => {
  it('valida datos completos correctamente (happy path)', () => {
    const result = cotizacionSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('falla sin campos requeridos', () => {
    const result = cotizacionSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('falla con nombreAgente muy corto', () => {
    const result = cotizacionSchema.safeParse({ ...validData, nombreAgente: 'A' })
    expect(result.success).toBe(false)
  })

  it('requiere edadesMenores cuando menores > 0', () => {
    const result = cotizacionSchema.safeParse({
      ...validData,
      menores: '2',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('edadesMenores')
    }
  })

  it('acepta edadesMenores con formato válido', () => {
    const result = cotizacionSchema.safeParse({
      ...validData,
      menores: '2',
      edadesMenores: '5, 8',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza edadesMenores con formato inválido', () => {
    const result = cotizacionSchema.safeParse({
      ...validData,
      menores: '2',
      edadesMenores: 'cinco, ocho',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza fechaRegreso anterior a fechaSalida', () => {
    const result = cotizacionSchema.safeParse({
      ...validData,
      fechaSalida: '2026-05-22',
      fechaRegreso: '2026-05-15',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message)
      expect(msgs.some((m) => m.includes('regreso'))).toBe(true)
    }
  })

  it('rechaza fecha inválida (30 de febrero)', () => {
    const result = cotizacionSchema.safeParse({
      ...validData,
      fechaSalida: '2026-02-30',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza notas con más de 300 caracteres', () => {
    const result = cotizacionSchema.safeParse({
      ...validData,
      notas: 'x'.repeat(301),
    })
    expect(result.success).toBe(false)
  })

  it('acepta notas vacías (campo opcional)', () => {
    const result = cotizacionSchema.safeParse({
      ...validData,
      notas: '',
    })
    expect(result.success).toBe(true)
  })
})
