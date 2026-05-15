import { describe, expect, it } from 'vitest'
import { folderDedupLogSchema } from './folderDedupLogSchema'

const base = {
  normalizedKey: 'asia mayo',
  canonicalId: 1942,
  canonicalName: 'ASIA MAYO',
  canonicalChildrenCount: 12,
  duplicateIds: [1943, 1944],
  duplicateNames: ['ASIA MAYO1', 'ASIA MAYO 2'],
  duplicatesChildrenCount: 4,
  totalChildrenInDuplicates: 4,
  executedAt: new Date('2026-05-14T18:00:00Z'),
  executedBy: 'script-9-5-execute' as const,
  snapshotFile: 'scripts/audit-output/9-5-folder-clusters-1715716800.json',
}

describe('folderDedupLogSchema', () => {
  it('acepta doc válido', () => {
    expect(folderDedupLogSchema.safeParse(base).success).toBe(true)
  })

  it('rechaza duplicateIds y duplicateNames con longitudes distintas', () => {
    const r = folderDedupLogSchema.safeParse({
      ...base,
      duplicateNames: ['ASIA MAYO1'],
    })
    expect(r.success).toBe(false)
  })

  it('rechaza canonicalId presente en duplicateIds', () => {
    const r = folderDedupLogSchema.safeParse({
      ...base,
      duplicateIds: [1942, 1943],
      duplicateNames: ['ASIA MAYO', 'ASIA MAYO1'],
    })
    expect(r.success).toBe(false)
  })

  it('rechaza duplicateIds vacío', () => {
    const r = folderDedupLogSchema.safeParse({
      ...base,
      duplicateIds: [],
      duplicateNames: [],
    })
    expect(r.success).toBe(false)
  })

  it('rechaza canonicalId no positivo', () => {
    const r = folderDedupLogSchema.safeParse({ ...base, canonicalId: 0 })
    expect(r.success).toBe(false)
  })

  it('acepta executedAt como string ISO', () => {
    const r = folderDedupLogSchema.safeParse({
      ...base,
      executedAt: '2026-05-14T18:00:00Z',
    })
    expect(r.success).toBe(true)
  })
})
