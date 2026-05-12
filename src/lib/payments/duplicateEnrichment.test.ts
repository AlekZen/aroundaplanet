import { describe, it, expect, vi } from 'vitest'
import { computeClusterFlags, applyEnrichment, enrichDuplicatePayments } from './duplicateEnrichment'
import type { OdooPaymentRow } from './duplicateClustering'

const baseRow = (overrides: Partial<OdooPaymentRow>): OdooPaymentRow => ({
  id: 0, name: 'P', memo: null, amount: 100, date: '2026-01-01',
  partnerId: 1, partnerName: 'X', journalId: 13, journalName: 'Bank',
  state: 'paid', xDupStatus: null, xCanonicalPaymentId: null,
  ...overrides,
})

describe('computeClusterFlags', () => {
  it('sameTrip=true, sameAgent=true cuando coinciden', () => {
    const r = computeClusterFlags([
      baseRow({ id: 1, tripName: 'Asia', agentName: 'Maria', date: '2026-01-01' }),
      baseRow({ id: 2, tripName: 'Asia', agentName: 'Maria', date: '2026-01-02' }),
    ])
    expect(r.sameTrip).toBe(true)
    expect(r.sameAgent).toBe(true)
    expect(r.maxDateDiffDays).toBe(1)
  })

  it('sameTrip=false cuando viajes difieren', () => {
    const r = computeClusterFlags([
      baseRow({ id: 1, tripName: 'Asia', agentName: 'Maria' }),
      baseRow({ id: 2, tripName: 'Europa', agentName: 'Maria' }),
    ])
    expect(r.sameTrip).toBe(false)
  })

  it('sameTrip=null cuando algún miembro sin tripName', () => {
    const r = computeClusterFlags([
      baseRow({ id: 1, tripName: 'Asia' }),
      baseRow({ id: 2, tripName: null }),
    ])
    expect(r.sameTrip).toBeNull()
  })

  it('maxDateDiffDays con 3 fechas', () => {
    const r = computeClusterFlags([
      baseRow({ id: 1, date: '2026-01-01' }),
      baseRow({ id: 2, date: '2026-01-05' }),
      baseRow({ id: 3, date: '2026-01-03' }),
    ])
    expect(r.maxDateDiffDays).toBe(4)
  })
})

describe('applyEnrichment', () => {
  it('mergea enrichment a rows preservando shape original', () => {
    const rows = [baseRow({ id: 1, memo: 'INV/001' })]
    const result = {
      byPaymentId: new Map([[1, {
        tripName: 'Asia',
        agentName: 'Maria',
        saleOrderName: 'S00123',
        paymentMethodLine: 'Manual',
        communication: 'primer abono',
        reconcileDate: null,
      }]]),
    }
    const out = applyEnrichment(rows, result)
    expect(out[0].tripName).toBe('Asia')
    expect(out[0].agentName).toBe('Maria')
    expect(out[0].saleOrderName).toBe('S00123')
    expect(out[0].memo).toBe('INV/001')
  })

  it('rows sin entry conservan campos originales', () => {
    const rows = [baseRow({ id: 999 })]
    const out = applyEnrichment(rows, { byPaymentId: new Map() })
    expect(out[0]).toEqual(rows[0])
  })
})

describe('enrichDuplicatePayments', () => {
  it('skips Odoo calls cuando no hay memos', async () => {
    const read = vi.fn().mockResolvedValue([])
    const searchRead = vi.fn().mockResolvedValue([])
    // Aun sin memos llama read (account.payment extras), pero NO searchRead account.move
    const client = { read, searchRead } as unknown as Parameters<typeof enrichDuplicatePayments>[0]
    const payments = [baseRow({ id: 1, memo: null })]
    const r = await enrichDuplicatePayments(client, payments)
    expect(r.byPaymentId.has(1)).toBe(true)
    expect(searchRead).not.toHaveBeenCalled()
  })

  it('tolera fallos en searchRead sin crashear', async () => {
    const read = vi.fn().mockResolvedValue([])
    const searchRead = vi.fn().mockRejectedValue(new Error('boom'))
    const client = { read, searchRead } as unknown as Parameters<typeof enrichDuplicatePayments>[0]
    const payments = [baseRow({ id: 1, memo: 'INV/001' })]
    const r = await enrichDuplicatePayments(client, payments)
    expect(r.byPaymentId.get(1)?.tripName).toBeNull()
  })
})
