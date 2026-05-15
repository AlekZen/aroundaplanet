import { describe, it, expect } from 'vitest'
import { contractSnapshotSchema, createContractSchema } from './contractSchema'

describe('contractSnapshotSchema', () => {
  const valid = {
    nombreCliente: 'FELIPE DE JESUS RUBIO RUIZ',
    viajeDestino: 'ASIA',
    viajeTemporada: 'MAYO 2026',
    montoTotalCents: 14500000,
    montoTotalFormatted: '$145,000.00 MXN',
    montoTotalLetras: 'CIENTO CUARENTA Y CINCO MIL PESOS 00/100 M.N.',
  }

  it('acepta snapshot mínimo válido', () => {
    const r = contractSnapshotSchema.safeParse(valid)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.ciudadFirma).toBe('Ocotlán, Jalisco')
  })

  it('rechaza monto cero o negativo', () => {
    const r = contractSnapshotSchema.safeParse({ ...valid, montoTotalCents: 0 })
    expect(r.success).toBe(false)
  })

  it('rechaza nombreCliente menor a 2 chars', () => {
    const r = contractSnapshotSchema.safeParse({ ...valid, nombreCliente: 'X' })
    expect(r.success).toBe(false)
  })
})

describe('createContractSchema', () => {
  it('acepta payload con solo templateId', () => {
    const r = createContractSchema.safeParse({ templateId: 'tpl-vam' })
    expect(r.success).toBe(true)
  })

  it('rechaza templateId vacío', () => {
    const r = createContractSchema.safeParse({ templateId: '' })
    expect(r.success).toBe(false)
  })

  it('acepta snapshotOverrides parcial', () => {
    const r = createContractSchema.safeParse({
      templateId: 'tpl-vam',
      snapshotOverrides: { nombreAcompanantes: 'Y MA TERESA' },
    })
    expect(r.success).toBe(true)
  })
})
