import { describe, it, expect } from 'vitest'
import {
  groupClusters,
  clusterStateOf,
  type OdooPaymentRow,
} from './duplicateClustering'

const baseRow = (overrides: Partial<OdooPaymentRow>): OdooPaymentRow => ({
  id: 0,
  name: 'P0001',
  memo: null,
  amount: 5000,
  date: '2026-01-08',
  partnerId: 4314,
  partnerName: 'Felipe Rubio',
  journalId: 13,
  journalName: 'Bank',
  state: 'paid',
  xDupStatus: null,
  xCanonicalPaymentId: null,
  ...overrides,
})

describe('groupClusters', () => {
  it('returns empty when no duplicates', () => {
    const payments = [
      baseRow({ id: 1, amount: 100, date: '2026-01-01' }),
      baseRow({ id: 2, amount: 200, date: '2026-02-01', partnerId: 9999 }),
    ]
    expect(groupClusters(payments)).toEqual([])
  })

  it('groups 2 payments with same partner+amount+date', () => {
    const payments = [
      baseRow({ id: 1 }),
      baseRow({ id: 2 }),
    ]
    const clusters = groupClusters(payments)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].members.map((m) => m.id).sort()).toEqual([1, 2])
    expect(clusters[0].currentState).toBe('unmarked')
    expect(clusters[0].clusterId).toBe('c_1_2')
  })

  it('groups 3 payments within 3-day window', () => {
    const payments = [
      baseRow({ id: 1, date: '2026-01-08' }),
      baseRow({ id: 2, date: '2026-01-09' }),
      baseRow({ id: 3, date: '2026-01-10' }),
    ]
    const clusters = groupClusters(payments)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].members).toHaveLength(3)
  })

  it('does NOT group when date diff > 3 days', () => {
    const payments = [
      baseRow({ id: 1, date: '2026-01-01' }),
      baseRow({ id: 2, date: '2026-01-05' }),
    ]
    const clusters = groupClusters(payments)
    expect(clusters).toHaveLength(0)
  })

  it('groups $1 off amount (tolerance)', () => {
    const payments = [
      baseRow({ id: 1, amount: 5000 }),
      baseRow({ id: 2, amount: 5001 }),
    ]
    const clusters = groupClusters(payments)
    expect(clusters).toHaveLength(1)
  })

  it('does NOT group different partners', () => {
    const payments = [
      baseRow({ id: 1, partnerId: 1000 }),
      baseRow({ id: 2, partnerId: 2000 }),
    ]
    expect(groupClusters(payments)).toEqual([])
  })

  it('clusterId is deterministic regardless of input order', () => {
    const c1 = groupClusters([baseRow({ id: 3 }), baseRow({ id: 1 }), baseRow({ id: 2 })])
    expect(c1[0].clusterId).toBe('c_1_2_3')
  })
})

describe('clusterStateOf', () => {
  it('unmarked: all members null', () => {
    const r = clusterStateOf([
      baseRow({ id: 1 }),
      baseRow({ id: 2 }),
    ])
    expect(r.currentState).toBe('unmarked')
    expect(r.canonicalId).toBeNull()
  })

  it('canonical_set: exactly 1 canónico + resto secundarios apuntando', () => {
    const r = clusterStateOf([
      baseRow({ id: 1, xDupStatus: 'canonico' }),
      baseRow({ id: 2, xDupStatus: 'secundario', xCanonicalPaymentId: 1 }),
      baseRow({ id: 3, xDupStatus: 'secundario', xCanonicalPaymentId: 1 }),
    ])
    expect(r.currentState).toBe('canonical_set')
    expect(r.canonicalId).toBe(1)
  })

  it('inconsistent: 2 canónicos', () => {
    const r = clusterStateOf([
      baseRow({ id: 1, xDupStatus: 'canonico' }),
      baseRow({ id: 2, xDupStatus: 'canonico' }),
    ])
    expect(r.currentState).toBe('inconsistent')
  })

  it('inconsistent: secundario apuntando fuera del cluster', () => {
    const r = clusterStateOf([
      baseRow({ id: 1, xDupStatus: 'canonico' }),
      baseRow({ id: 2, xDupStatus: 'secundario', xCanonicalPaymentId: 999 }),
    ])
    expect(r.currentState).toBe('inconsistent')
  })

  it('inconsistent: mix de marcado y unmarked', () => {
    const r = clusterStateOf([
      baseRow({ id: 1, xDupStatus: 'canonico' }),
      baseRow({ id: 2 }),
    ])
    expect(r.currentState).toBe('inconsistent')
  })
})
