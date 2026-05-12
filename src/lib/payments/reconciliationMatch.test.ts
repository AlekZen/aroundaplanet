import { describe, it, expect } from 'vitest'
import {
  scoreMatch,
  normalizePartner,
  jaccard,
  tokenSet,
  dayDiff,
} from './reconciliationMatch'

describe('reconciliationMatch', () => {
  describe('normalizePartner', () => {
    it('strips diacritics and lowercases', () => {
      expect(normalizePartner('José Pérez Núñez')).toBe('jose perez nunez')
    })
    it('handles null/empty', () => {
      expect(normalizePartner(null)).toBe('')
      expect(normalizePartner('')).toBe('')
      expect(normalizePartner('   ')).toBe('')
    })
    it('collapses non-alphanumeric', () => {
      expect(normalizePartner('FELIPE-JESÚS, RUIZ.')).toBe('felipe jesus ruiz')
    })
  })

  describe('jaccard', () => {
    it('returns 1.0 for identical token sets', () => {
      expect(jaccard(tokenSet('Felipe Rubio'), tokenSet('Felipe Rubio'))).toBe(1.0)
    })
    it('returns 0 for disjoint sets', () => {
      expect(jaccard(tokenSet('Alice Brown'), tokenSet('Bob Green'))).toBe(0)
    })
    it('handles partial overlap', () => {
      expect(jaccard(tokenSet('Felipe Rubio Ruiz'), tokenSet('Felipe Rubio'))).toBeCloseTo(2 / 3)
    })
    it('returns 0 if either side empty', () => {
      expect(jaccard(new Set(), tokenSet('abc'))).toBe(0)
    })
  })

  describe('dayDiff', () => {
    it('returns 0 for same date', () => {
      expect(dayDiff('2026-01-01', '2026-01-01')).toBe(0)
    })
    it('returns abs diff', () => {
      expect(dayDiff('2026-01-01', '2026-01-04')).toBe(3)
      expect(dayDiff('2026-01-04', '2026-01-01')).toBe(3)
    })
  })

  describe('scoreMatch', () => {
    const baseFs = { partnerName: 'Felipe Rubio Ruiz', amount: 5000, dateYmd: '2026-01-08' }
    const baseOdoo = { partnerName: 'Felipe Rubio Ruiz', amount: 5000, dateYmd: '2026-01-08' }

    it('high confidence: identical partner, amount, date', () => {
      const r = scoreMatch({ firestore: baseFs, odoo: baseOdoo })
      expect(r.confidence).toBe('high')
      expect(r.diff.partnerJaccard).toBe(1.0)
      expect(r.diff.amountDiff).toBe(0)
      expect(r.diff.dateDiff).toBe(0)
    })

    it('high confidence: dateDiff=1 still high if rest matches', () => {
      const r = scoreMatch({
        firestore: baseFs,
        odoo: { ...baseOdoo, dateYmd: '2026-01-09' },
      })
      expect(r.confidence).toBe('high')
    })

    it('medium: partner abbreviated but jaccard>=0.6', () => {
      const r = scoreMatch({
        firestore: { ...baseFs, partnerName: 'Felipe Rubio Ruiz Hernandez' },
        odoo: { ...baseOdoo, partnerName: 'Felipe Rubio Ruiz' },
      })
      expect(['high', 'medium']).toContain(r.confidence)
      expect(r.diff.partnerJaccard).toBeGreaterThanOrEqual(0.6)
    })

    it('medium: $1 amount diff still acceptable', () => {
      const r = scoreMatch({
        firestore: baseFs,
        odoo: { ...baseOdoo, amount: 5001 },
      })
      expect(['high', 'medium']).toContain(r.confidence)
      expect(r.diff.amountDiff).toBe(1)
    })

    it('low: 2 of 3 criteria pass (partner+amount ok, date 4d off)', () => {
      const r = scoreMatch({
        firestore: baseFs,
        odoo: { ...baseOdoo, dateYmd: '2026-01-12' },
      })
      expect(r.confidence).toBe('low')
      expect(r.diff.dateDiff).toBe(4)
    })

    it('none: amount way off, date way off, partner differs', () => {
      const r = scoreMatch({
        firestore: baseFs,
        odoo: { partnerName: 'Carlos Sanchez', amount: 9999, dateYmd: '2025-12-01' },
      })
      expect(r.confidence).toBe('none')
    })

    it('reasons include checkmark/cross for each criterion', () => {
      const r = scoreMatch({ firestore: baseFs, odoo: baseOdoo })
      expect(r.reasons).toHaveLength(3)
      expect(r.reasons[0]).toMatch(/partner[✓✗]/)
      expect(r.reasons[1]).toMatch(/amount[✓✗]/)
      expect(r.reasons[2]).toMatch(/date[✓✗]/)
    })

    it('missing dates: dateDiff=999, date criterion fails', () => {
      const r = scoreMatch({
        firestore: { ...baseFs, dateYmd: null },
        odoo: baseOdoo,
      })
      expect(r.diff.dateDiff).toBe(999)
      expect(r.confidence).not.toBe('high')
    })
  })
})
