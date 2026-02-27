import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useAuthStore } from '@/stores/useAuthStore'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

// Mock firebase deps to avoid timeout
vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({})),
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updateProfile: vi.fn(),
}))

const mockLogout = vi.fn()
vi.mock('@/lib/firebase/auth', () => ({
  logout: mockLogout,
}))

// Warmup import
let Navbar: React.ComponentType<{ className?: string }>
beforeAll(async () => {
  const mod = await import('./Navbar')
  Navbar = mod.Navbar
})

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: null,
      profile: null,
      claims: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    })
  })

  it('shows "Iniciar Sesion" CTA when not authenticated', () => {
    render(<Navbar />)

    const loginLinks = screen.getAllByText('Iniciar Sesion')
    expect(loginLinks.length).toBeGreaterThan(0)
  })

  it('shows skeleton pulse when loading', () => {
    useAuthStore.setState({
      isLoading: true,
      isAuthenticated: false,
    })

    const { container } = render(<Navbar />)

    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)

    // Should NOT show login or logout buttons while loading
    expect(screen.queryByText('Iniciar Sesion')).not.toBeInTheDocument()
    expect(screen.queryByText('Salir')).not.toBeInTheDocument()
  })

  it('shows "Salir" button when authenticated', () => {
    useAuthStore.setState({
      user: { uid: '123', displayName: 'Test User', email: 'test@example.com' } as never,
      isAuthenticated: true,
      claims: { roles: ['cliente'] },
    })

    render(<Navbar />)

    const logoutButtons = screen.getAllByText('Salir')
    expect(logoutButtons.length).toBeGreaterThan(0)
  })

  it('calls logout when Salir button is clicked', () => {
    useAuthStore.setState({
      user: { uid: '123', displayName: 'Test User', email: 'test@example.com' } as never,
      isAuthenticated: true,
      claims: { roles: ['cliente'] },
    })

    render(<Navbar />)

    // Click the first visible Salir button (desktop)
    const logoutButtons = screen.getAllByText('Salir')
    fireEvent.click(logoutButtons[0])

    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it('shows "Mi Panel" button for authenticated user instead of role nav items', () => {
    useAuthStore.setState({
      user: { uid: '123', displayName: 'Agent User', email: 'agent@example.com' } as never,
      isAuthenticated: true,
      claims: { roles: ['cliente', 'agente'], agentId: 'agent456' },
    })

    render(<Navbar />)

    // Should show "Mi Panel" button
    const panelLinks = screen.getAllByText('Mi Panel')
    expect(panelLinks.length).toBeGreaterThan(0)

    // Should NOT show old role-specific nav items
    expect(screen.queryByText('Mi Portal')).not.toBeInTheDocument()
    expect(screen.queryByText('Mis Clientes')).not.toBeInTheDocument()
    expect(screen.queryByText('Mis Viajes')).not.toBeInTheDocument()
  })

  it('shows user display name when authenticated', () => {
    useAuthStore.setState({
      user: { uid: '123', displayName: 'Maria Lopez', email: 'maria@example.com' } as never,
      isAuthenticated: true,
      claims: { roles: ['cliente'] },
    })

    render(<Navbar />)

    const nameElements = screen.getAllByText('Maria Lopez')
    expect(nameElements.length).toBeGreaterThan(0)
  })

  it('sets aria-current="page" on active public nav link', () => {
    render(<Navbar />)

    // pathname is '/' (mocked), so "Inicio" should have aria-current
    const inicioLinks = screen.getAllByText('Inicio')
    const activeLink = inicioLinks.find((el) => el.getAttribute('aria-current') === 'page')
    expect(activeLink).toBeDefined()

    // "Viajes" should NOT have aria-current
    const viajesLinks = screen.getAllByText('Viajes')
    const inactiveLink = viajesLinks.find((el) => el.getAttribute('aria-current') === 'page')
    expect(inactiveLink).toBeUndefined()
  })
})
