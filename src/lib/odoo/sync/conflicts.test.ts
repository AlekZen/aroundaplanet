import { describe, it, expect } from 'vitest'
import { detectLwwConflict, valuesEqualForField } from './conflicts'

describe('valuesEqualForField', () => {
  it('amount tolera ±1 centavo', () => {
    expect(valuesEqualForField('amount', 500000, 500001)).toBe(true)
    expect(valuesEqualForField('amount', 500000, 500002)).toBe(false)
  })

  it('memo trimmed case-sensitive', () => {
    expect(valuesEqualForField('memo', ' hola ', 'hola')).toBe(true)
    expect(valuesEqualForField('memo', 'hola', 'Hola')).toBe(false)
  })

  it('paymentDate compara YYYY-MM-DD UTC', () => {
    expect(valuesEqualForField('paymentDate', '2026-05-14', '2026-05-14')).toBe(true)
    expect(
      valuesEqualForField('paymentDate', new Date('2026-05-14T03:00:00Z'), '2026-05-14'),
    ).toBe(true)
    expect(valuesEqualForField('paymentDate', '2026-05-14', '2026-05-15')).toBe(false)
  })

  it('null vs null → true; null vs valor → false', () => {
    expect(valuesEqualForField('memo', null, null)).toBe(true)
    expect(valuesEqualForField('memo', null, 'x')).toBe(false)
  })
})

describe('detectLwwConflict', () => {
  const lastCursor = '2026-05-14 12:00:00' // epoch ms ~

  it('firestoreLww null → odoo_wins (mirror inicial)', () => {
    const r = detectLwwConflict({
      field: 'memo',
      firestoreLww: null,
      odooValue: 'nuevo',
      odooWriteDate: '2026-05-14 12:10:00',
      lastCursor,
    })
    expect(r.resolution).toBe('odoo_wins')
    expect(r.odooLww).toMatchObject({ value: 'nuevo', source: 'odoo' })
  })

  it('valores iguales → noop', () => {
    const r = detectLwwConflict({
      field: 'memo',
      firestoreLww: { value: 'x', writtenAt: '2026-05-14 11:59:00', source: 'firestore' },
      odooValue: 'x',
      odooWriteDate: '2026-05-14 12:10:00',
      lastCursor,
    })
    expect(r.resolution).toBe('noop')
  })

  it('Firestore más reciente → firestore_wins (skip)', () => {
    const r = detectLwwConflict({
      field: 'memo',
      firestoreLww: { value: 'fs-new', writtenAt: '2026-05-14 13:00:00', source: 'firestore' },
      odooValue: 'odoo-old',
      odooWriteDate: '2026-05-14 12:00:00',
      lastCursor,
    })
    expect(r.resolution).toBe('firestore_wins')
  })

  it('Odoo newer + Firestore antes del cursor → odoo_wins legítimo', () => {
    const r = detectLwwConflict({
      field: 'memo',
      firestoreLww: {
        value: 'fs-antiguo',
        writtenAt: '2026-05-14 10:00:00', // antes del cursor
        source: 'firestore',
      },
      odooValue: 'odoo-nuevo',
      odooWriteDate: '2026-05-14 12:10:00',
      lastCursor,
    })
    expect(r.resolution).toBe('odoo_wins')
  })

  it('Odoo newer + Firestore DESPUÉS del cursor → conflict', () => {
    const r = detectLwwConflict({
      field: 'memo',
      firestoreLww: {
        value: 'fs-edit',
        writtenAt: '2026-05-14 12:05:00', // después del cursor 12:00
        source: 'firestore',
      },
      odooValue: 'odoo-edit',
      odooWriteDate: '2026-05-14 12:08:00',
      lastCursor,
    })
    expect(r.resolution).toBe('conflict')
  })

  it('diferencia <30s → tratado como skew (firestore_wins)', () => {
    const r = detectLwwConflict({
      field: 'memo',
      firestoreLww: {
        value: 'a',
        writtenAt: '2026-05-14 12:10:00',
        source: 'firestore',
      },
      odooValue: 'b',
      odooWriteDate: '2026-05-14 12:10:20', // 20s después
      lastCursor,
    })
    expect(r.resolution).toBe('firestore_wins')
  })

  it('amount con tolerancia ±1 cent → noop aunque difieran por 1', () => {
    const r = detectLwwConflict({
      field: 'amount',
      firestoreLww: { value: 500000, writtenAt: '2026-05-14 11:59:00', source: 'firestore' },
      odooValue: 500001,
      odooWriteDate: '2026-05-14 12:10:00',
      lastCursor,
    })
    expect(r.resolution).toBe('noop')
  })

  it('Firestore Timestamp shape vs Odoo string compara correctamente', () => {
    const r = detectLwwConflict({
      field: 'memo',
      firestoreLww: {
        value: 'old',
        writtenAt: { seconds: Math.floor(Date.UTC(2026, 4, 14, 10, 0, 0) / 1000), nanoseconds: 0 },
        source: 'firestore',
      },
      odooValue: 'new',
      odooWriteDate: '2026-05-14 12:10:00',
      lastCursor,
    })
    expect(r.resolution).toBe('odoo_wins') // FS antes del cursor (12:00)
  })
})
