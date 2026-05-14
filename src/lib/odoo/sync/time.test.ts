import { describe, it, expect } from 'vitest'
import { toEpochMs } from './time'

describe('toEpochMs', () => {
  it('null/undefined → 0', () => {
    expect(toEpochMs(null)).toBe(0)
    expect(toEpochMs(undefined)).toBe(0)
  })

  it('number passthrough', () => {
    expect(toEpochMs(1234567890)).toBe(1234567890)
  })

  it('Date → ms', () => {
    const d = new Date('2026-05-14T12:00:00Z')
    expect(toEpochMs(d)).toBe(d.getTime())
  })

  it('ISO string con Z', () => {
    expect(toEpochMs('2026-05-14T12:00:00Z')).toBe(Date.UTC(2026, 4, 14, 12, 0, 0))
  })

  it('ISO con offset +HH:MM', () => {
    expect(toEpochMs('2026-05-14T14:00:00+02:00')).toBe(Date.UTC(2026, 4, 14, 12, 0, 0))
  })

  it('Odoo write_date YYYY-MM-DD HH:MM:SS sin sufijo → UTC', () => {
    expect(toEpochMs('2026-05-14 12:00:00')).toBe(Date.UTC(2026, 4, 14, 12, 0, 0))
  })

  it('Odoo write_date con milisegundos', () => {
    expect(toEpochMs('2026-05-14 12:00:00.123')).toBe(Date.UTC(2026, 4, 14, 12, 0, 0, 123))
  })

  it('fecha pura YYYY-MM-DD → medianoche UTC', () => {
    expect(toEpochMs('2026-05-14')).toBe(Date.UTC(2026, 4, 14))
  })

  it('Firestore Timestamp shape {seconds, nanoseconds}', () => {
    const ts = { seconds: 1747224000, nanoseconds: 500_000_000 }
    expect(toEpochMs(ts)).toBe(1747224000 * 1000 + 500)
  })

  it('Firestore Timestamp con método toDate()', () => {
    const d = new Date('2026-05-14T12:00:00Z')
    const ts = { seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0, toDate: () => d }
    expect(toEpochMs(ts)).toBe(d.getTime())
  })

  it('string vacío o garbage → 0 (NO NaN)', () => {
    expect(toEpochMs('')).toBe(0)
    expect(toEpochMs('not a date')).toBe(0)
  })

  it('NaN number → 0', () => {
    expect(toEpochMs(NaN)).toBe(0)
  })

  it('comparación Odoo vs Firestore Timestamp funciona', () => {
    const odooNewer = '2026-05-14 12:00:01'
    const firestoreOlder = { seconds: Math.floor(Date.UTC(2026, 4, 14, 12, 0, 0) / 1000), nanoseconds: 0 }
    expect(toEpochMs(odooNewer) > toEpochMs(firestoreOlder)).toBe(true)
  })
})
