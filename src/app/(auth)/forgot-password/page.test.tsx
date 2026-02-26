import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({})),
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ForgotPasswordPage: any

describe('ForgotPasswordPage', () => {
  beforeAll(async () => {
    const mod = await import('./page')
    ForgotPasswordPage = mod.default
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders forgot password form', () => {
    render(<ForgotPasswordPage />)

    expect(screen.getByRole('heading', { name: /recuperar contraseña/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/correo electronico/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar enlace/i })).toBeInTheDocument()
  })

  it('renders back to login link', () => {
    render(<ForgotPasswordPage />)

    expect(screen.getByText(/volver a iniciar sesion/i)).toBeInTheDocument()
  })

  it('has accessible email input', () => {
    render(<ForgotPasswordPage />)

    const emailInput = screen.getByLabelText(/correo electronico/i)
    expect(emailInput).toHaveAttribute('type', 'email')
  })
})
