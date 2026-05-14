import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { SyncConsoleDashboard } from './SyncConsoleDashboard'
import type { InitialCounts, CursorSummary } from './page'

// Stub de componentes dependientes que no son parte de esta prueba
vi.mock('./ConflictsTable', () => ({
  ConflictsTable: () => <div data-testid="conflicts-table">ConflictsTable</div>,
}))
vi.mock('./PushQueueTable', () => ({
  PushQueueTable: () => <div data-testid="push-queue-table">PushQueueTable</div>,
}))
vi.mock('./AlertsTable', () => ({
  AlertsTable: () => <div data-testid="alerts-table">AlertsTable</div>,
}))

const defaultCounts: InitialCounts = {
  conflicts: 3,
  pushQueue: 5,
  alerts: 2,
  alertsByType: { odoo_canceled: 1, attachment_failed: 1 },
  attachmentQueue: 4,
}

const defaultCursor: CursorSummary = {
  lastRunAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // hace 10 min
  summary: { fetched: 20, matched: 15, updated: 3, conflicts: 2, alerts: 1, unmatched: 2, validationFailures: 0, durationMs: 1200 },
  lastError: null,
  successRate24h: 90,
}

afterEach(() => {
  cleanup()
})

describe('SyncConsoleDashboard', () => {
  it('renderiza los 5 KPI cards', () => {
    render(<SyncConsoleDashboard initialCounts={defaultCounts} cursorSummary={defaultCursor} />)

    // Algunos textos aparecen dos veces (KPICard + TabsTrigger)
    expect(screen.getAllByText('Conflictos pendientes').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Cola de push').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Alertas activas')).toBeInTheDocument()
    expect(screen.getByText('Último pull')).toBeInTheDocument()
    expect(screen.getByText('Éxito 24h')).toBeInTheDocument()
  })

  it('muestra los conteos correctos', () => {
    render(<SyncConsoleDashboard initialCounts={defaultCounts} cursorSummary={defaultCursor} />)

    // KPICard con aria-label verifica title:value
    expect(screen.getByLabelText('Conflictos pendientes: 3')).toBeInTheDocument()
    expect(screen.getByLabelText('Cola de push: 5')).toBeInTheDocument()
    expect(screen.getByLabelText('Éxito 24h: 90%')).toBeInTheDocument()
  })

  it('muestra sub-badges de alertas por tipo', () => {
    render(<SyncConsoleDashboard initialCounts={defaultCounts} cursorSummary={defaultCursor} />)

    expect(screen.getByText(/Cancelado: 1/)).toBeInTheDocument()
    expect(screen.getByText(/Adjunto fallido: 1/)).toBeInTheDocument()
  })

  it('muestra "—" en tasa de éxito cuando no hay datos', () => {
    const cursor: CursorSummary = { ...defaultCursor, successRate24h: null }
    render(<SyncConsoleDashboard initialCounts={defaultCounts} cursorSummary={cursor} />)
    expect(screen.getByLabelText('Éxito 24h: —')).toBeInTheDocument()
  })

  it('muestra badge de error en Último pull cuando hay lastError', () => {
    const cursor: CursorSummary = { ...defaultCursor, lastError: 'Connection timeout after 30s' }
    render(<SyncConsoleDashboard initialCounts={defaultCounts} cursorSummary={cursor} />)
    // Verifica badge de error
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('renderiza los 3 tabs', () => {
    render(<SyncConsoleDashboard initialCounts={defaultCounts} cursorSummary={defaultCursor} />)

    expect(screen.getByRole('tab', { name: /Conflictos/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Cola de push/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Alertas/ })).toBeInTheDocument()
  })

  it('renderiza botón Exportar CSV en el tab de conflictos', () => {
    render(<SyncConsoleDashboard initialCounts={defaultCounts} cursorSummary={defaultCursor} />)
    // El tab de conflictos está activo por defecto
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument()
  })

  it('renderiza ConflictsTable en tab conflicts activo', () => {
    render(<SyncConsoleDashboard initialCounts={defaultCounts} cursorSummary={defaultCursor} />)
    expect(screen.getByTestId('conflicts-table')).toBeInTheDocument()
  })

  it('muestra "Nunca" cuando lastRunAt es null', () => {
    const cursor: CursorSummary = { ...defaultCursor, lastRunAt: null, summary: null }
    render(<SyncConsoleDashboard initialCounts={defaultCounts} cursorSummary={cursor} />)
    expect(screen.getByText('Nunca')).toBeInTheDocument()
  })
})
