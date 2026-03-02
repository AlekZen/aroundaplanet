import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/lib/utils', () => ({
  formatCurrency: (cents: number) => `$${(cents / 100).toLocaleString()}`,
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

import { useAuthStore } from '@/stores/useAuthStore'
import AgentLeadsPage from './page'

const mockUseAuthStore = vi.mocked(useAuthStore)

describe('AgentLeadsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows no-access message when agentId is missing', () => {
    mockUseAuthStore.mockReturnValue({ claims: null } as ReturnType<typeof useAuthStore>)

    render(<AgentLeadsPage />)

    expect(screen.getByText('Sin acceso a leads')).toBeDefined()
  })

  it('shows empty state with CTA when agent has no orders', async () => {
    mockUseAuthStore.mockReturnValue({
      claims: { uid: 'u1', roles: ['agente'], agentId: 'agent-lupita' },
    } as ReturnType<typeof useAuthStore>)

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ orders: [], total: 0 }),
    } as Response)

    render(<AgentLeadsPage />)

    await waitFor(() => {
      expect(screen.getByText('Tu primer cliente te espera')).toBeDefined()
    })
    expect(screen.getByText('Comparte tu link')).toBeDefined()
  })

  it('renders orders when agent has leads', async () => {
    mockUseAuthStore.mockReturnValue({
      claims: { uid: 'u1', roles: ['agente'], agentId: 'agent-lupita' },
    } as ReturnType<typeof useAuthStore>)

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        orders: [
          { id: 'o1', contactName: 'Juan Perez', tripName: 'Vuelta al Mundo', status: 'Interesado', amountTotalCents: 14500000, createdAt: { _seconds: 1709000000 } },
        ],
        total: 1,
      }),
    } as Response)

    render(<AgentLeadsPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Juan Perez').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('Vuelta al Mundo').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Interesado').length).toBeGreaterThanOrEqual(1)
  })
})
