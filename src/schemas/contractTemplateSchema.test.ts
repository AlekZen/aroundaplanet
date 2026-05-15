import { describe, it, expect } from 'vitest'
import { contractTemplateSchema } from './contractTemplateSchema'

describe('contractTemplateSchema', () => {
  const valid = {
    templateId: 'tpl-vam',
    templateKey: 'vuelta-al-mundo',
    destinoLabel: 'VUELTA AL MUNDO',
    scope: 'internacional' as const,
    plazoLimitePagoDias: 60,
    anexoIncluye: ['Vuelos desde CDMX', 'Hospedaje 4 estrellas'],
    anexoVisitamos: ['China', 'Malasia'],
    anexoNoIncluye: ['Alimentos no incluidos'],
    active: true,
    notes: null,
  }

  it('acepta payload válido', () => {
    const r = contractTemplateSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it('rechaza templateKey con mayúsculas o espacios', () => {
    const r = contractTemplateSchema.safeParse({ ...valid, templateKey: 'Vuelta al Mundo' })
    expect(r.success).toBe(false)
  })

  it('rechaza anexoIncluye vacío', () => {
    const r = contractTemplateSchema.safeParse({ ...valid, anexoIncluye: [] })
    expect(r.success).toBe(false)
  })

  it('rechaza plazoLimitePagoDias fuera de rango', () => {
    const r = contractTemplateSchema.safeParse({ ...valid, plazoLimitePagoDias: 0 })
    expect(r.success).toBe(false)
  })

  it('aplica default active=true cuando no se envía', () => {
    const { active: _omit, ...rest } = valid
    void _omit
    const r = contractTemplateSchema.safeParse(rest)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.active).toBe(true)
  })
})
