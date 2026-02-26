import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAuthStore } from '@/stores/useAuthStore'

const mockPush = vi.fn()
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}))

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
let RegisterPage: any

describe('RegisterPage', () => {
  beforeAll(async () => {
    const mod = await import('./page')
    RegisterPage = mod.default
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useAuthStore).mockReturnValue(DEFAULT_AUTH as any)
  })

  it('renders register form with all fields', () => {
    render(<RegisterPage />)

    expect(screen.getByRole('heading', { name: /crear cuenta/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/correo electronico/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeInTheDocument()
  })

  it('renders Google sign-in button', () => {
    render(<RegisterPage />)

    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument()
  })

  it('renders login link', () => {
    render(<RegisterPage />)

    expect(screen.getByText(/inicia sesion/i)).toBeInTheDocument()
  })

  it('shows skeleton when loading', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: null,
      profile: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<RegisterPage />)

    expect(screen.queryByRole('heading', { name: /crear cuenta/i })).not.toBeInTheDocument()
  })

  it('redirects if already authenticated', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { uid: '123' },
      profile: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<RegisterPage />)

    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('has accessible form with correct input types', () => {
    render(<RegisterPage />)

    expect(screen.getByLabelText(/nombre completo/i)).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText(/correo electronico/i)).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(/confirmar contraseña/i)).toHaveAttribute('type', 'password')
  })
})
