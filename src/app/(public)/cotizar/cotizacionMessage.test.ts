import { describe, it, expect } from 'vitest'
import { buildCotizacionMessage } from './cotizacionMessage'
import type { CotizacionFormData } from '@/schemas/cotizacionSchema'

const baseData: CotizacionFormData = {
  nombreAgente: 'María López',
  nombreCliente: 'Juan Pérez García',
  tipoViaje: 'Internacional',
  destino: 'Cancún, México',
  fechaSalida: '2026-05-15',
  fechaRegreso: '2026-05-22',
  adultos: '2',
  menores: '0',
  habitaciones: '1',
  presupuesto: '$25K-$50K',
}

describe('buildCotizacionMessage', () => {
  it('contiene todos los campos del formulario', () => {
    const msg = buildCotizacionMessage(baseData)
    expect(msg).toContain('María López')
    expect(msg).toContain('Juan Pérez García')
    expect(msg).toContain('Internacional')
    expect(msg).toContain('Cancún, México')
    expect(msg).toContain('$25K-$50K')
  })

  it('formatea fechas como DD/MM/YYYY', () => {
    const msg = buildCotizacionMessage(baseData)
    expect(msg).toContain('15/05/2026')
    expect(msg).toContain('22/05/2026')
    expect(msg).not.toContain('2026-05-15')
  })

  it('omite línea de menores cuando menores es 0', () => {
    const msg = buildCotizacionMessage(baseData)
    expect(msg).not.toContain('Menores')
    expect(msg).not.toContain('edades')
  })

  it('incluye menores y edades cuando menores > 0', () => {
    const msg = buildCotizacionMessage({
      ...baseData,
      menores: '2',
      edadesMenores: '5, 8',
    })
    expect(msg).toContain('*Menores:* 2')
    expect(msg).toContain('edades: 5, 8')
  })

  it('omite notas cuando están vacías', () => {
    const msg = buildCotizacionMessage({ ...baseData, notas: '' })
    expect(msg).not.toContain('Notas')
  })

  it('incluye notas cuando tienen contenido', () => {
    const msg = buildCotizacionMessage({
      ...baseData,
      notas: 'Preferencia por hotel all-inclusive.',
    })
    expect(msg).toContain('*Notas:* Preferencia por hotel all-inclusive.')
  })

  it('usa negritas de WhatsApp (*texto*), no markdown (**)', () => {
    const msg = buildCotizacionMessage(baseData)
    expect(msg).toContain('*Asesor:*')
    expect(msg).not.toContain('**')
  })

  it('funciona con caracteres especiales', () => {
    const msg = buildCotizacionMessage({
      ...baseData,
      nombreAgente: 'Señor García',
      destino: 'Zürich, Suiza',
    })
    expect(msg).toContain('Señor García')
    expect(msg).toContain('Zürich, Suiza')
  })

  it('no excede 1500 caracteres con datos máximos razonables', () => {
    const msg = buildCotizacionMessage({
      ...baseData,
      nombreAgente: 'A'.repeat(50),
      nombreCliente: 'B'.repeat(50),
      destino: 'C'.repeat(50),
      menores: '10',
      edadesMenores: '1, 2, 3, 4, 5, 6, 7, 8, 9, 10',
      notas: 'N'.repeat(300),
    })
    expect(msg.length).toBeLessThanOrEqual(1500)
  })
})
