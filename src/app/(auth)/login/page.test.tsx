import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAuthStore } from '@/stores/useAuthStore'

// Mock next/navigation
const mockPush = vi.fn()
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock firebase modules
vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({})),
  FirebaseError: class FirebaseError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

// Mock auth store
vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(() => ({
    isLoading: false,
    isAuthenticated: false,
    user: null,
    profile: null,
  })),
}))

const DEFAULT_AUTH = {
  isLoading: false,
  isAuthenticated: false,
  user: null,
  profile: null,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let LoginPage: any

describe('LoginPage', () => {
  beforeAll(async () => {
    const mod = await import('./page')
    LoginPage = mod.default
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useAuthStore).mockReturnValue(DEFAULT_AUTH as any)
  })

  it('renders login form with email and password fields', () => {
    render(<LoginPage />)

    expect(screen.getByRole('heading', { name: /iniciar sesion/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/correo electronico/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iniciar sesion/i })).toBeInTheDocument()
  })

  it('renders Google sign-in button', () => {
    render(<LoginPage />)

    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument()
  })

  it('renders forgot password link', () => {
    render(<LoginPage />)

    expect(screen.getByText(/olvide mi contraseña/i)).toBeInTheDocument()
  })

  it('renders register link', () => {
    render(<LoginPage />)

    expect(screen.getByText(/registrate/i)).toBeInTheDocument()
  })

  it('shows skeleton when loading', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: null,
      profile: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<LoginPage />)

    expect(screen.queryByRole('heading', { name: /iniciar sesion/i })).not.toBeInTheDocument()
  })

  it('redirects if already authenticated', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { uid: '123' },
      profile: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<LoginPage />)

    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('has accessible form labels', () => {
    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/correo electronico/i)
    const passwordInput = screen.getByLabelText(/contraseña/i)

    expect(emailInput).toHaveAttribute('type', 'email')
    expect(passwordInput).toHaveAttribute('type', 'password')
  })
})
