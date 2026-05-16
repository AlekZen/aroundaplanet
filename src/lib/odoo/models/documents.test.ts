import { describe, it, expect } from 'vitest'
import { matchFolderToProduct, classifyFolder } from './documents'
import { normalizeOdooDocumentName } from '@/schemas/odooDocumentsSchema'
import type { OdooRecord } from '@/types/odoo'

const products: OdooRecord[] = [
  { id: 1748, name: 'ASIA MAYO 2026' },
  { id: 1749, name: 'ASIA MAYO1 2026' },
  { id: 1927, name: 'COLOMBIA MAYO 2026 ORIGINAL' },
  { id: 1928, name: 'COLOMBIA MAYO 2026 VUELO DESDE GDL' },
  { id: 1545, name: 'CHEPE ENERO 2026' },
]

describe('normalizeOdooDocumentName', () => {
  it('quita acentos, baja a minúsculas, colapsa puntuación a espacio', () => {
    expect(normalizeOdooDocumentName('ASIÁ-MAYO  2026!!')).toBe('asia mayo 2026')
  })
  it('trimea y maneja nullish', () => {
    expect(normalizeOdooDocumentName(null)).toBe('')
    expect(normalizeOdooDocumentName(undefined)).toBe('')
    expect(normalizeOdooDocumentName('   ASIA   ')).toBe('asia')
  })
  it('ñ se descompone a n vía NFD (tilde stripped)', () => {
    expect(normalizeOdooDocumentName('Año Nuevo')).toBe('ano nuevo')
  })
})

describe('matchFolderToProduct', () => {
  it('exact match → linked confidence 100', () => {
    const m = matchFolderToProduct('ASIA MAYO 2026', products)
    expect(m.status).toBe('linked')
    expect(m.productId).toBe(1748)
    expect(m.confidence).toBe(100)
    expect(m.reason).toBeNull()
  })

  it('distingue cluster ASIA MAYO vs ASIA MAYO1 (no colisiona)', () => {
    expect(matchFolderToProduct('ASIA MAYO 2026', products).productId).toBe(1748)
    expect(matchFolderToProduct('ASIA MAYO1 2026', products).productId).toBe(1749)
  })

  it('match con espacios y acentos extra → normaliza y matchea', () => {
    const m = matchFolderToProduct('  asiá  mayo  2026  ', products)
    expect(m.status).toBe('linked')
    expect(m.productId).toBe(1748)
  })

  it('ambigüedad cuando ≥2 productos comparten tokens fuertes → unmatched ambiguous-match', () => {
    const m = matchFolderToProduct('COLOMBIA MAYO 2026', products)
    expect(m.status).toBe('unmatched')
    expect(m.reason).toBe('ambiguous-match')
  })

  it('folder operacional sin match → unmatched operational-folder', () => {
    const m = matchFolderToProduct('PAGOS VIAJES 2026', products)
    expect(m.status).toBe('unmatched')
    expect(m.reason).toBe('operational-folder')
  })

  it('folder genérico sin match → unmatched no-product-match', () => {
    const m = matchFolderToProduct('Random Folder XYZ', products)
    expect(m.status).toBe('unmatched')
    expect(m.reason).toBe('no-product-match')
  })

  it('folder vacío → unmatched missing-folder-name', () => {
    const m = matchFolderToProduct('', products)
    expect(m.status).toBe('unmatched')
    expect(m.reason).toBe('missing-folder-name')
  })

  it('product names ausentes/strings vacíos no rompen', () => {
    const m = matchFolderToProduct('ASIA MAYO 2026', [
      { id: 99, name: '' },
      { id: 100, name: 'ASIA MAYO 2026' },
    ])
    expect(m.status).toBe('linked')
    expect(m.productId).toBe(100)
  })
})

describe('classifyFolder', () => {
  it.each([
    ['PAGOS VIAJES 2026', 'payment'],
    ['VENTAS ABRIL 2026', 'sales'],
    ['COTIZACIONES 2026', 'quote'],
    ['CUPONES 2025', 'coupon'],
    ['CONTRATOS TOUR INTERNACIONAL', 'contract'],
  ] as const)('clasifica %s como %s', (path, expected) => {
    expect(classifyFolder(path, 'unmatched')).toBe(expected)
  })

  it('ITINERARIOS y flyers con relation=unmatched → internal', () => {
    expect(classifyFolder('ITINERARIOS y flyers', 'unmatched')).toBe('internal')
  })
  it('ITINERARIOS con relation=linked → trip-backoffice', () => {
    expect(classifyFolder('ITINERARIOS y flyers', 'linked')).toBe('trip-backoffice')
  })
  it('folder neutro con relation=linked → trip-backoffice', () => {
    expect(classifyFolder('ASIA MAYO 2026', 'linked')).toBe('trip-backoffice')
  })
  it('folder neutro con relation=unmatched → unmatched', () => {
    expect(classifyFolder('Random folder', 'unmatched')).toBe('unmatched')
  })
})
