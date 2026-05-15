import { describe, it, expect } from 'vitest'
import { findTemplateForTrip } from './findTemplate'
import type { ContractTemplate } from '@/schemas/contractTemplateSchema'

const TEMPLATES: ContractTemplate[] = [
  { templateId: 't1', templateKey: 'asia', destinoLabel: 'ASIA', scope: 'internacional', plazoLimitePagoDias: 30, anexoIncluye: ['x'], anexoVisitamos: [], anexoNoIncluye: [], active: true, notes: null },
  { templateId: 't2', templateKey: 'colombia-mayo', destinoLabel: 'COLOMBIA MAYO', scope: 'internacional', plazoLimitePagoDias: 30, anexoIncluye: ['x'], anexoVisitamos: [], anexoNoIncluye: [], active: true, notes: null },
  { templateId: 't3', templateKey: 'europa-septiembre', destinoLabel: 'EUROPA SEPTIEMBRE', scope: 'internacional', plazoLimitePagoDias: 30, anexoIncluye: ['x'], anexoVisitamos: [], anexoNoIncluye: [], active: true, notes: null },
  { templateId: 't4', templateKey: 'chepe-enero', destinoLabel: 'CHEPE ENERO', scope: 'nacional', plazoLimitePagoDias: 30, anexoIncluye: ['x'], anexoVisitamos: [], anexoNoIncluye: [], active: true, notes: null },
  { templateId: 't5', templateKey: 'vuelta-al-mundo', destinoLabel: 'VUELTA AL MUNDO', scope: 'internacional', plazoLimitePagoDias: 60, anexoIncluye: ['x'], anexoVisitamos: [], anexoNoIncluye: [], active: true, notes: null },
]

describe('findTemplateForTrip', () => {
  it('match exacto cuando todos los tokens del destino coinciden', () => {
    const r = findTemplateForTrip('COLOMBIA MAYO 2026 ORIGINAL', 'odoo-1694', TEMPLATES)
    expect(r.template?.templateKey).toBe('colombia-mayo')
    expect(r.score).toBe(1)
  })

  it('match con acentos y signos', () => {
    const r = findTemplateForTrip('Europa Septiembre — 2026', 'odoo-221', TEMPLATES)
    expect(r.template?.templateKey).toBe('europa-septiembre')
  })

  it('match ASIA con variantes', () => {
    expect(findTemplateForTrip('ASIA MAYO 2026', null, TEMPLATES).template?.templateKey).toBe('asia')
    expect(findTemplateForTrip('Asia 2026', null, TEMPLATES).template?.templateKey).toBe('asia')
  })

  it('match VUELTA AL MUNDO ignorando años', () => {
    const r = findTemplateForTrip('VUELTA AL MUNDO 2025', null, TEMPLATES)
    expect(r.template?.templateKey).toBe('vuelta-al-mundo')
  })

  it('NULL cuando no hay match (ej. ARGENTINA BRASIL)', () => {
    const r = findTemplateForTrip('ARGENTINA BRASIL 2026', 'odoo-1015', TEMPLATES)
    expect(r.template).toBeNull()
    expect(r.reason).toContain('No se encontró plantilla')
  })

  it('NULL cuando match parcial (COLOMBIA sin MAYO)', () => {
    const r = findTemplateForTrip('COLOMBIA OCTUBRE 2026', null, TEMPLATES)
    expect(r.template).toBeNull()
  })

  it('NULL cuando tripName y tripId vacíos', () => {
    const r = findTemplateForTrip(null, null, TEMPLATES)
    expect(r.template).toBeNull()
    expect(r.reason).toContain('viaje no tiene nombre')
  })

  it('NULL cuando catálogo vacío', () => {
    const r = findTemplateForTrip('ASIA', 'odoo-1', [])
    expect(r.template).toBeNull()
    expect(r.reason).toContain('catálogo')
  })

  it('Prefiere destinoLabel más largo cuando empata score', () => {
    const extra: ContractTemplate[] = [
      ...TEMPLATES,
      { templateId: 't-ce-d', templateKey: 'chepe-enero-deluxe', destinoLabel: 'CHEPE ENERO DELUXE', scope: 'nacional', plazoLimitePagoDias: 30, anexoIncluye: ['x'], anexoVisitamos: [], anexoNoIncluye: [], active: true, notes: null },
    ]
    const r = findTemplateForTrip('CHEPE ENERO DELUXE 2026', null, extra)
    expect(r.template?.templateKey).toBe('chepe-enero-deluxe')
  })
})
