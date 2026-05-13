import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OdooSyncBadge } from './OdooSyncBadge'

describe('OdooSyncBadge', () => {
  it('renders synced with id and journal', () => {
    render(<OdooSyncBadge status="synced" odooPaymentId={8400} odooJournalName="Bank" />)
    expect(screen.getByText(/Synced Odoo #8400 · Bank/)).toBeInTheDocument()
  })

  it('renders pending when status is null', () => {
    render(<OdooSyncBadge status={null} />)
    expect(screen.getByText(/Sincronizando/)).toBeInTheDocument()
  })

  it('renders error with truncated tooltip', () => {
    const longError = 'a'.repeat(300)
    render(<OdooSyncBadge status="error" odooLastError={longError} />)
    const badge = screen.getByText(/Sync error/)
    expect(badge).toBeInTheDocument()
    expect(badge.getAttribute('title')?.length).toBeLessThanOrEqual(201)
  })

  it('renders orphan with id', () => {
    render(<OdooSyncBadge status="orphan" odooPaymentId={8500} />)
    expect(screen.getByText(/Huérfano Odoo #8500/)).toBeInTheDocument()
  })

  it('renders legacy_linked with id', () => {
    render(<OdooSyncBadge status="legacy_linked" odooPaymentId={7000} />)
    expect(screen.getByText(/Legacy Odoo #7000/)).toBeInTheDocument()
  })

  it('returns null for never_synced', () => {
    const { container } = render(<OdooSyncBadge status="never_synced" />)
    expect(container.firstChild).toBeNull()
  })
})
