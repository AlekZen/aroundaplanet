import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OdooSyncCard } from './OdooSyncCard'
import type { OdooSyncResult } from './OdooSyncCard'

const MOCK_SYNC_RESULT: OdooSyncResult = {
  total: 45,
  created: 5,
  updated: 12,
  errors: 0,
  syncedAt: new Date().toISOString(),
  isStale: false,
}

describe('OdooSyncCard', () => {
  it('renders with "Nunca sincronizado" when no lastSync', () => {
    render(<OdooSyncCard onSync={vi.fn().mockResolvedValue(MOCK_SYNC_RESULT)} />)
    expect(screen.getByText('Nunca sincronizado')).toBeInTheDocument()
    expect(screen.getByText('Sincronizacion Odoo')).toBeInTheDocument()
  })

  it('shows sync button with correct text', () => {
    render(<OdooSyncCard onSync={vi.fn().mockResolvedValue(MOCK_SYNC_RESULT)} />)
    expect(screen.getByRole('button', { name: /sincronizar desde odoo/i })).toBeInTheDocument()
  })

  it('shows last sync info when lastSync is provided', () => {
    const lastSync = {
      syncedAt: new Date(Date.now() - 5 * 60000).toISOString(), // 5 minutes ago
      total: 30,
      isStale: false,
    }
    render(<OdooSyncCard onSync={vi.fn().mockResolvedValue(MOCK_SYNC_RESULT)} lastSync={lastSync} />)
    expect(screen.getByText(/hace 5 minutos/)).toBeInTheDocument()
    expect(screen.getByText('30 usuarios sincronizados')).toBeInTheDocument()
  })

  it('shows stale warning badge when lastSync.isStale is true', () => {
    const lastSync = {
      syncedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      total: 20,
      isStale: true,
    }
    render(<OdooSyncCard onSync={vi.fn().mockResolvedValue(MOCK_SYNC_RESULT)} lastSync={lastSync} />)
    expect(screen.getByText('Datos desactualizados')).toBeInTheDocument()
  })

  it('shows loading state during sync', async () => {
    let resolveSync: (value: OdooSyncResult) => void
    const onSync = vi.fn().mockImplementation(() => new Promise<OdooSyncResult>((resolve) => {
      resolveSync = resolve
    }))
    render(<OdooSyncCard onSync={onSync} />)

    fireEvent.click(screen.getByRole('button', { name: /sincronizar desde odoo/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sincronizando/i })).toBeDisabled()
    })

    // Resolve to cleanup
    resolveSync!(MOCK_SYNC_RESULT)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sincronizar desde odoo/i })).not.toBeDisabled()
    })
  })

  it('displays results after successful sync', async () => {
    const onSync = vi.fn().mockResolvedValue({
      total: 45,
      created: 5,
      updated: 12,
      errors: 0,
      syncedAt: new Date().toISOString(),
      isStale: false,
    })
    render(<OdooSyncCard onSync={onSync} />)

    fireEvent.click(screen.getByRole('button', { name: /sincronizar desde odoo/i }))

    await waitFor(() => {
      expect(screen.getByText('Sincronizacion completada')).toBeInTheDocument()
    })
    expect(screen.getByText('Total: 45')).toBeInTheDocument()
    expect(screen.getByText('Creados: 5')).toBeInTheDocument()
    expect(screen.getByText('Actualizados: 12')).toBeInTheDocument()
  })

  it('displays error count when sync has errors', async () => {
    const onSync = vi.fn().mockResolvedValue({
      total: 45,
      created: 3,
      updated: 10,
      errors: 2,
      syncedAt: new Date().toISOString(),
      isStale: false,
    })
    render(<OdooSyncCard onSync={onSync} />)

    fireEvent.click(screen.getByRole('button', { name: /sincronizar desde odoo/i }))

    await waitFor(() => {
      expect(screen.getByText('Errores: 2')).toBeInTheDocument()
    })
  })

  it('handles sync errors gracefully', async () => {
    const onSync = vi.fn().mockRejectedValue(new Error('Connection timeout'))
    render(<OdooSyncCard onSync={onSync} />)

    fireEvent.click(screen.getByRole('button', { name: /sincronizar desde odoo/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Connection timeout')).toBeInTheDocument()
    })
    // Button should be re-enabled after error
    expect(screen.getByRole('button', { name: /sincronizar desde odoo/i })).not.toBeDisabled()
  })

  it('handles non-Error sync failures gracefully', async () => {
    const onSync = vi.fn().mockRejectedValue('unknown error')
    render(<OdooSyncCard onSync={onSync} />)

    fireEvent.click(screen.getByRole('button', { name: /sincronizar desde odoo/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Error desconocido al sincronizar')).toBeInTheDocument()
    })
  })

  it('has aria-label for accessibility', () => {
    render(<OdooSyncCard onSync={vi.fn().mockResolvedValue(MOCK_SYNC_RESULT)} />)
    expect(screen.getByLabelText('Sincronizacion Odoo')).toBeInTheDocument()
  })

  it('clears previous results before new sync', async () => {
    const onSync = vi.fn()
      .mockResolvedValueOnce({ total: 10, created: 2, updated: 3, errors: 0, syncedAt: new Date().toISOString(), isStale: false })
      .mockResolvedValueOnce({ total: 20, created: 5, updated: 8, errors: 1, syncedAt: new Date().toISOString(), isStale: false })

    render(<OdooSyncCard onSync={onSync} />)

    // First sync
    fireEvent.click(screen.getByRole('button', { name: /sincronizar desde odoo/i }))
    await waitFor(() => {
      expect(screen.getByText('Total: 10')).toBeInTheDocument()
    })

    // Second sync
    fireEvent.click(screen.getByRole('button', { name: /sincronizar desde odoo/i }))
    await waitFor(() => {
      expect(screen.getByText('Total: 20')).toBeInTheDocument()
    })
    expect(screen.queryByText('Total: 10')).not.toBeInTheDocument()
  })

  it('shows relative time for last sync in hours', () => {
    const lastSync = {
      syncedAt: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
      total: 15,
      isStale: false,
    }
    render(<OdooSyncCard onSync={vi.fn().mockResolvedValue(MOCK_SYNC_RESULT)} lastSync={lastSync} />)
    expect(screen.getByText(/hace 2 horas/)).toBeInTheDocument()
  })
})
