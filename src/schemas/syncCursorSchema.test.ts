import { describe, it, expect } from 'vitest'
import {
  syncCursorSchema,
  defaultCursor24hAgo,
  formatOdooDateTime,
  BOOTSTRAP_EPOCH_CURSOR,
} from './syncCursorSchema'

describe('syncCursorSchema', () => {
  it('acepta cursor con lastCursor null (primer run)', () => {
    expect(syncCursorSchema.safeParse({ lastCursor: null }).success).toBe(true)
  })

  it('acepta cursor ISO Odoo', () => {
    expect(
      syncCursorSchema.safeParse({
        lastCursor: '2026-05-14 12:00:00',
        lastRunAt: '2026-05-14T12:00:01Z',
        lastRunSummary: { fetched: 10, matched: 9, updated: 9 },
        lastError: null,
      }).success,
    ).toBe(true)
  })

  it('rechaza lastError > 2000 chars', () => {
    const long = 'x'.repeat(2001)
    expect(syncCursorSchema.safeParse({ lastCursor: null, lastError: long }).success).toBe(false)
  })
})

describe('formatOdooDateTime', () => {
  it('produce YYYY-MM-DD HH:MM:SS UTC sin sufijo', () => {
    const d = new Date('2026-05-14T07:08:09Z')
    expect(formatOdooDateTime(d)).toBe('2026-05-14 07:08:09')
  })

  it('cero-padea componentes', () => {
    const d = new Date('2026-01-02T03:04:05Z')
    expect(formatOdooDateTime(d)).toBe('2026-01-02 03:04:05')
  })
})

describe('defaultCursor24hAgo', () => {
  it('retorna timestamp ~24h atrás formateado', () => {
    const now = new Date('2026-05-14T12:00:00Z')
    expect(defaultCursor24hAgo(now)).toBe('2026-05-13 12:00:00')
  })
})

describe('BOOTSTRAP_EPOCH_CURSOR', () => {
  it('es el epoch en formato Odoo', () => {
    expect(BOOTSTRAP_EPOCH_CURSOR).toBe('1970-01-01 00:00:00')
  })
})
