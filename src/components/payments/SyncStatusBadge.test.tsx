import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyncStatusBadge } from './SyncStatusBadge'

const NOW = new Date('2026-05-14T16:00:00Z').getTime()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

function verifiedPaymentBase() {
  return { status: 'verified' as const }
}

describe('SyncStatusBadge', () => {
  // ── Estado 1: synced ───────────────────────────────────────────────────────
  it('muestra badge verde con id y journal cuando synced', () => {
    render(
      <SyncStatusBadge
        payment={{ ...verifiedPaymentBase(), odooSyncStatus: 'synced', odooPaymentId: 8134, odooJournalName: 'Bank' }}
      />,
    )
    expect(screen.getByText(/Synced Odoo #8134 · Bank/)).toBeInTheDocument()
  })

  it('synced sin journal muestra "Sin journal"', () => {
    render(
      <SyncStatusBadge
        payment={{ ...verifiedPaymentBase(), odooSyncStatus: 'synced', odooPaymentId: 8134, odooJournalName: null }}
      />,
    )
    expect(screen.getByText(/Synced Odoo #8134 · Sin journal/)).toBeInTheDocument()
  })

  // ── Estado 2: legacy_linked ────────────────────────────────────────────────
  it('muestra "legacy" cuando legacy_linked', () => {
    render(
      <SyncStatusBadge
        payment={{ ...verifiedPaymentBase(), odooSyncStatus: 'legacy_linked', odooPaymentId: 7000 }}
      />,
    )
    expect(screen.getByText(/legacy/)).toBeInTheDocument()
    expect(screen.getByText(/Synced Odoo #7000 · legacy/)).toBeInTheDocument()
  })

  // ── Estado 3: dismissed ────────────────────────────────────────────────────
  it('muestra "Sync descartado" cuando dismissed', () => {
    render(
      <SyncStatusBadge
        payment={{ ...verifiedPaymentBase(), odooSyncStatus: 'dismissed', odooSyncDismissedReason: 'Pago duplicado' }}
      />,
    )
    const badge = screen.getByText('Sync descartado')
    expect(badge).toBeInTheDocument()
    expect(badge.closest('[title]')?.getAttribute('title') ?? badge.getAttribute('title')).toBe('Pago duplicado')
  })

  // ── Estado 4: error ────────────────────────────────────────────────────────
  it('muestra "Sync con error" con tooltip truncado a 120 chars', () => {
    const longError = 'E'.repeat(200)
    render(
      <SyncStatusBadge
        payment={{ ...verifiedPaymentBase(), odooSyncStatus: 'error', odooLastError: longError }}
        paymentId="pay-abc"
      />,
    )
    const badge = screen.getByText(/Sync con error/)
    expect(badge).toBeInTheDocument()
    const tooltipText = badge.closest('[title]')?.getAttribute('title') ?? badge.getAttribute('title') ?? ''
    expect(tooltipText.length).toBeLessThanOrEqual(121) // 120 + '…'
  })

  it('error sin paymentId renderiza link a sync-console sin paymentId en query', () => {
    render(
      <SyncStatusBadge
        payment={{ ...verifiedPaymentBase(), odooSyncStatus: 'error', odooLastError: 'timeout' }}
      />,
    )
    expect(screen.getByText(/Sync con error/)).toBeInTheDocument()
    const link = document.querySelector('a')
    expect(link?.getAttribute('href')).toContain('/admin/payments/sync-console')
  })

  // ── Estado 5: pending reciente (<5min desde verifiedAt) ───────────────────
  it('muestra "Encolado" cuando pending y verifiedAt hace <5min', () => {
    const recentVerified = new Date(NOW - 2 * 60 * 1000).toISOString() // 2min atrás
    render(
      <SyncStatusBadge
        payment={{ ...verifiedPaymentBase(), odooSyncStatus: 'pending', verifiedAt: recentVerified }}
      />,
    )
    expect(screen.getByText(/Encolado/)).toBeInTheDocument()
  })

  // ── Estado 6: pending demorado (≥5min) ────────────────────────────────────
  it('muestra "Sync demorado" cuando pending y verifiedAt hace ≥5min', () => {
    const oldVerified = new Date(NOW - 10 * 60 * 1000).toISOString() // 10min atrás
    render(
      <SyncStatusBadge
        payment={{ ...verifiedPaymentBase(), odooSyncStatus: 'pending', verifiedAt: oldVerified }}
      />,
    )
    expect(screen.getByText(/Sync demorado/)).toBeInTheDocument()
  })

  // ── Fallback drift: odooPaymentId sin odooSyncStatus ──────────────────────
  it('fallback drift: odooPaymentId + odooSyncedAt reciente → Synced', () => {
    const recentSynced = new Date(NOW - 60 * 1000).toISOString() // 1min atrás
    render(
      <SyncStatusBadge
        payment={{
          ...verifiedPaymentBase(),
          odooPaymentId: 8200,
          odooSyncStatus: null,
          odooSyncedAt: recentSynced,
          odooJournalName: 'Cash',
        }}
      />,
    )
    expect(screen.getByText(/Synced Odoo #8200/)).toBeInTheDocument()
  })

  it('fallback drift: odooPaymentId sin odooSyncedAt → Encolado (pending)', () => {
    const recentVerified = new Date(NOW - 1 * 60 * 1000).toISOString()
    render(
      <SyncStatusBadge
        payment={{
          ...verifiedPaymentBase(),
          odooPaymentId: 8300,
          odooSyncStatus: null,
          odooSyncedAt: null,
          verifiedAt: recentVerified,
        }}
      />,
    )
    expect(screen.getByText(/Encolado/)).toBeInTheDocument()
  })

  // ── status !== 'verified' → null ──────────────────────────────────────────
  it('retorna null cuando status es pending_verification', () => {
    const { container } = render(
      <SyncStatusBadge
        payment={{ status: 'pending_verification', odooSyncStatus: 'pending' }}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('retorna null cuando status es undefined', () => {
    const { container } = render(
      <SyncStatusBadge payment={{ odooSyncStatus: 'pending' }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  // ── NUNCA muestra "Sincronizando" ─────────────────────────────────────────
  it('NUNCA muestra el texto "Sincronizando" en ningún estado', () => {
    const cases = [
      { ...verifiedPaymentBase(), odooSyncStatus: 'pending' as const, verifiedAt: new Date(NOW - 1000).toISOString() },
      { ...verifiedPaymentBase(), odooSyncStatus: 'pending' as const, verifiedAt: new Date(NOW - 600000).toISOString() },
      { ...verifiedPaymentBase(), odooSyncStatus: null as null, verifiedAt: new Date(NOW - 1000).toISOString() },
      { ...verifiedPaymentBase(), odooSyncStatus: 'error' as const, odooLastError: 'fallo' },
    ]

    for (const payment of cases) {
      const { unmount, queryByText } = render(<SyncStatusBadge payment={payment} />)
      expect(queryByText(/Sincronizando/i)).toBeNull()
      unmount()
    }
  })
})
