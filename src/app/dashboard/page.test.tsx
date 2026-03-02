import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAuthStore } from '@/stores/useAuthStore'

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
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
  useAuthStore: vi.fn(),
}))

// Warmup import to avoid timeout in forked process
let DashboardPage: React.ComponentType
beforeAll(async () => {
  const mod = await import('./page')
  DashboardPage = mod.default
})

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows skeleton while loading', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: null,
      claims: null,
      profile: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<DashboardPage />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('redirects to login if not authenticated', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      claims: null,
      profile: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<DashboardPage />)

    expect(mockReplace).toHaveBeenCalledWith('/login')
  })

  it('redirects to role dashboard when authenticated', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { uid: '123' },
      claims: { uid: '123', roles: ['admin'] },
      profile: { roles: ['admin'] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<DashboardPage />)

    expect(mockReplace).toHaveBeenCalled()
  })

  it('redirects cliente to default dashboard', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { uid: '123' },
      claims: { uid: '123', roles: ['cliente'] },
      profile: { roles: ['cliente'] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<DashboardPage />)

    expect(mockReplace).toHaveBeenCalledWith('/client/my-trips')
  })
})
