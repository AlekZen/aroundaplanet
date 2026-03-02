import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => <div className={className} data-testid="skeleton" />,
}))

import { AgentSelectorDialog } from './AgentSelectorDialog'

const MOCK_AGENTS = [
  { uid: 'u1', agentId: 'agent-lupita', displayName: 'Lupita Gomez', email: 'lupita@test.com', isActive: true, roles: ['agente'] },
  { uid: 'u2', agentId: 'agent-maria', displayName: 'Maria Sanchez', email: 'maria@test.com', isActive: true, roles: ['agente'] },
]

describe('AgentSelectorDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches and displays agents when opened', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ users: MOCK_AGENTS }),
    } as Response)

    render(
      <AgentSelectorDialog isOpen={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('Lupita Gomez')).toBeDefined()
      expect(screen.getByText('Maria Sanchez')).toBeDefined()
    })
  })

  it('filters agents by search text', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ users: MOCK_AGENTS }),
    } as Response)

    render(
      <AgentSelectorDialog isOpen={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('Lupita Gomez')).toBeDefined()
    })

    const searchInput = screen.getByLabelText('Buscar agente')
    fireEvent.change(searchInput, { target: { value: 'maria' } })

    expect(screen.queryByText('Lupita Gomez')).not.toBeInTheDocument()
    expect(screen.getByText('Maria Sanchez')).toBeDefined()
  })

  it('calls onSelect with agentId (not uid) when agent is clicked', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ users: MOCK_AGENTS }),
    } as Response)

    const onSelect = vi.fn()
    render(
      <AgentSelectorDialog isOpen={true} onOpenChange={vi.fn()} onSelect={onSelect} />
    )

    await waitFor(() => {
      expect(screen.getByText('Lupita Gomez')).toBeDefined()
    })

    // Click Lupita's row
    fireEvent.click(screen.getByText('Lupita Gomez').closest('button')!)

    expect(onSelect).toHaveBeenCalledWith('agent-lupita')
  })

  it('shows error state when fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Sin permisos' }),
    } as Response)

    render(
      <AgentSelectorDialog isOpen={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('Sin permisos')).toBeDefined()
    })
    expect(screen.getByText('Reintentar')).toBeDefined()
  })

  it('does not render when closed', () => {
    render(
      <AgentSelectorDialog isOpen={false} onOpenChange={vi.fn()} onSelect={vi.fn()} />
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
