import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('./AgentCatalogContent', () => ({
  AgentCatalogContent: ({ agentId }: { agentId: string }) => (
    <div data-testid="agent-catalog">{agentId}</div>
  ),
}))

vi.mock('@/app/(public)/viajes/CatalogSkeleton', () => ({
  CatalogSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}))

import { useAuthStore } from '@/stores/useAuthStore'
import AgentCatalogPage from './page'

const mockUseAuthStore = vi.mocked(useAuthStore)

describe('AgentCatalogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders catalog with agentId when claims have agentId', () => {
    mockUseAuthStore.mockReturnValue({
      claims: { uid: 'u1', roles: ['agente'], agentId: 'agent-lupita' },
    } as ReturnType<typeof useAuthStore>)

    render(<AgentCatalogPage />)

    expect(screen.getByText('Mi Catalogo')).toBeDefined()
    expect(screen.getByTestId('agent-catalog')).toBeDefined()
    expect(screen.getByText('agent-lupita')).toBeDefined()
  })

  it('shows error when claims lack agentId', () => {
    mockUseAuthStore.mockReturnValue({
      claims: { uid: 'u2', roles: ['cliente'] },
    } as ReturnType<typeof useAuthStore>)

    render(<AgentCatalogPage />)

    expect(screen.getByText('Sin acceso al catalogo')).toBeDefined()
  })

  it('shows error when claims is null', () => {
    mockUseAuthStore.mockReturnValue({
      claims: null,
    } as ReturnType<typeof useAuthStore>)

    render(<AgentCatalogPage />)

    expect(screen.getByText('Sin acceso al catalogo')).toBeDefined()
  })
})
