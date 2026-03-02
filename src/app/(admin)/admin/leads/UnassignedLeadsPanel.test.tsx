import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/utils', () => ({
  formatCurrency: (cents: number) => `$${(cents / 100).toLocaleString()}`,
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('./AgentSelectorDialog', () => ({
  AgentSelectorDialog: ({ isOpen, onSelect }: { isOpen: boolean; onSelect: (id: string) => void }) =>
    isOpen ? (
      <div data-testid="agent-dialog">
        <button onClick={() => onSelect('agent-lupita')}>Seleccionar Lupita</button>
      </div>
    ) : null,
}))

import { UnassignedLeadsPanel } from './UnassignedLeadsPanel'

describe('UnassignedLeadsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows empty state when no unassigned orders', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ orders: [], total: 0 }),
    } as Response)

    render(<UnassignedLeadsPanel />)

    await waitFor(() => {
      expect(screen.getByText('No hay leads sin asignar')).toBeDefined()
    })
  })

  it('renders unassigned orders with assign button', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        orders: [
          {
            id: 'o1',
            contactName: 'Ana Garcia',
            contactPhone: '+525551234567',
            tripName: 'Europa Express',
            status: 'Interesado',
            amountTotalCents: 14500000,
            createdAt: { _seconds: 1709000000 },
          },
        ],
        total: 1,
      }),
    } as Response)

    render(<UnassignedLeadsPanel />)

    await waitFor(() => {
      expect(screen.getAllByText('Ana Garcia').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('Europa Express').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Interesado').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Asignar').length).toBeGreaterThanOrEqual(1)
  })

  it('opens agent dialog when Asignar is clicked', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        orders: [
          {
            id: 'o1',
            contactName: 'Ana Garcia',
            contactPhone: '+525551234567',
            tripName: 'Europa Express',
            status: 'Interesado',
            amountTotalCents: 14500000,
            createdAt: { _seconds: 1709000000 },
          },
        ],
        total: 1,
      }),
    } as Response)

    render(<UnassignedLeadsPanel />)

    await waitFor(() => {
      expect(screen.getAllByText('Ana Garcia').length).toBeGreaterThanOrEqual(1)
    })

    // Click first Asignar button
    const assignButtons = screen.getAllByText('Asignar')
    fireEvent.click(assignButtons[0])

    expect(screen.getByTestId('agent-dialog')).toBeDefined()
  })

  it('calls assign API when agent is selected', async () => {
    const fetchMock = vi.mocked(fetch)
    // First call: fetch orders
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        orders: [
          {
            id: 'o1',
            contactName: 'Ana Garcia',
            contactPhone: '+525551234567',
            tripName: 'Europa Express',
            status: 'Interesado',
            amountTotalCents: 14500000,
            createdAt: { _seconds: 1709000000 },
          },
        ],
        total: 1,
      }),
    } as Response)

    render(<UnassignedLeadsPanel />)

    await waitFor(() => {
      expect(screen.getAllByText('Ana Garcia').length).toBeGreaterThanOrEqual(1)
    })

    // Click Asignar
    const assignButtons = screen.getAllByText('Asignar')
    fireEvent.click(assignButtons[0])

    // Mock assign response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ orderId: 'o1', agentId: 'agent-lupita', assigned: true }),
    } as Response)
    // Mock refetch
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ orders: [], total: 0 }),
    } as Response)

    // Select agent from dialog
    fireEvent.click(screen.getByText('Seleccionar Lupita'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/orders/o1/assign', expect.objectContaining({
        method: 'PATCH',
      }))
    })
  })

  it('shows error state when fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Sin permisos' }),
    } as Response)

    render(<UnassignedLeadsPanel />)

    await waitFor(() => {
      expect(screen.getByText('Sin permisos')).toBeDefined()
    })
    expect(screen.getByText('Reintentar')).toBeDefined()
  })
})
