import { describe, it, expect } from 'vitest'
import { createQuotationSchema, quotationLeadSnapshotSchema } from './quotationSchema'

describe('quotationLeadSnapshotSchema', () => {
  const valid = {
    nombreAgente: 'Paloma Aguilar',
    nombreCliente: 'Juan Pérez',
    contactPhone: '+52 392 123 4567',
    tipoViaje: 'Internacional' as const,
    destino: 'Madrid, España',
    fechaSalida: '2026-09-01',
    fechaRegreso: '2026-09-15',
    adultos: '2',
    menores: '0',
    edadesMenores: '',
    habitaciones: '1',
    presupuesto: '$50K-$100K' as const,
    notas: 'Aniversario de bodas',
  }

  it('acepta payload válido', () => {
    const r = quotationLeadSnapshotSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it('rechaza tipoViaje fuera de enum', () => {
    const r = quotationLeadSnapshotSchema.safeParse({ ...valid, tipoViaje: 'Galáctico' })
    expect(r.success).toBe(false)
  })

  it('rechaza contactEmail inválido', () => {
    const r = quotationLeadSnapshotSchema.safeParse({ ...valid, contactEmail: 'not-an-email' })
    expect(r.success).toBe(false)
  })
})

describe('createQuotationSchema', () => {
  const validLead = {
    nombreCliente: 'Juan Pérez',
    tipoViaje: 'Nacional' as const,
    destino: 'CHEPE',
    fechaSalida: '2026-06-01',
    fechaRegreso: '2026-06-07',
    adultos: '2',
    menores: '0',
    habitaciones: '1',
    presupuesto: '$10K-$25K' as const,
  }

  it('acepta payload mínimo válido', () => {
    const r = createQuotationSchema.safeParse({
      source: 'cotizar-public',
      leadSnapshot: validLead,
      whatsappSent: true,
    })
    expect(r.success).toBe(true)
  })

  it('rechaza source no permitido', () => {
    const r = createQuotationSchema.safeParse({
      source: 'malicious',
      leadSnapshot: validLead,
    })
    expect(r.success).toBe(false)
  })
})
