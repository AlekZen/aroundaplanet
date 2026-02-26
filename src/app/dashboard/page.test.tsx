import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAuthStore } from '@/stores/useAuthStore'

const mockPush = vi.fn()
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({})),
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  signOut: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(() => ({
    isLoading: false,
    isAuthenticated: true,
    user: { uid: '123' },
    profile: {
      displayName: 'Juan Perez',
      email: 'juan@example.com',
    },
  })),
}))

const DEFAULT_DASHBOARD_AUTH = {
  isLoading: false,
  isAuthenticated: true,
  user: { uid: '123' },
  profile: {
    displayName: 'Juan Perez',
    email: 'juan@example.com',
  },
}

// Warmup import to avoid timeout in forked process
let DashboardPage: React.ComponentType
beforeAll(async () => {
  const mod = await import('./page')
  DashboardPage = mod.default
})

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useAuthStore).mockReturnValue(DEFAULT_DASHBOARD_AUTH as any)
  })

  it('renders welcome message with display name', () => {
    render(<DashboardPage />)

    const welcomeMessages = screen.getAllByText(/bienvenido, juan perez/i)
    expect(welcomeMessages.length).toBeGreaterThan(0)
    expect(screen.getAllByText('juan@example.com').length).toBeGreaterThan(0)
  })

  it('renders logout button', () => {
    render(<DashboardPage />)

    const logoutButtons = screen.getAllByRole('button', { name: /cerrar sesion/i })
    expect(logoutButtons.length).toBeGreaterThan(0)
  })

  it('redirects to login if not authenticated', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      profile: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<DashboardPage />)

    expect(mockReplace).toHaveBeenCalledWith('/login')
  })

  it('shows skeleton while loading', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: null,
      profile: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<DashboardPage />)

    expect(screen.queryByRole('button', { name: /cerrar sesion/i })).not.toBeInTheDocument()
  })
})
