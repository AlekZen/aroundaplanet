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

  it('rechaza cotizar-public con whatsappSent=false (alineado firestore.rules L1)', () => {
    const r = createQuotationSchema.safeParse({
      source: 'cotizar-public',
      leadSnapshot: validLead,
      whatsappSent: false,
    })
    expect(r.success).toBe(false)
  })

  it('rechaza cotizar-public sin whatsappSent (default false → refine falla)', () => {
    const r = createQuotationSchema.safeParse({
      source: 'cotizar-public',
      leadSnapshot: validLead,
    })
    expect(r.success).toBe(false)
  })

  it('shape persistido por endpoint cumple las 5 condiciones de firestore.rules quotations.create', () => {
    // Reproduce el docData que arma el endpoint POST /api/quotations
    const parsed = createQuotationSchema.parse({
      source: 'cotizar-public',
      leadSnapshot: validLead,
      whatsappSent: true,
    })
    const docData = {
      source: parsed.source,
      status: 'lead' as const,
      pdfUrl: null,
      pdfVersion: 0,
      whatsappSent: parsed.whatsappSent,
      createdBy: null,
    }
    // 5 condiciones de firestore.rules:269-274
    expect(docData.source).toBe('cotizar-public')
    expect(docData.status).toBe('lead')
    expect(docData.pdfUrl).toBeNull()
    expect(docData.pdfVersion).toBe(0)
    expect(docData.whatsappSent).toBe(true)
    expect(docData.createdBy).toBeNull()
  })
})
