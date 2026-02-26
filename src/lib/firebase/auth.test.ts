import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock firebase/app
vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({})),
}))

const mockSignInWithEmailAndPassword = vi.fn()
const mockCreateUserWithEmailAndPassword = vi.fn()
const mockSignInWithPopup = vi.fn()
const mockSignOut = vi.fn()
const mockSendPasswordResetEmail = vi.fn()
const mockUpdateProfile = vi.fn()
const mockGetAuth = vi.fn(() => ({}))

vi.mock('firebase/auth', () => ({
  getAuth: mockGetAuth,
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  createUserWithEmailAndPassword: mockCreateUserWithEmailAndPassword,
  signInWithPopup: mockSignInWithPopup,
  GoogleAuthProvider: vi.fn(),
  signOut: mockSignOut,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
  updateProfile: mockUpdateProfile,
}))

describe('Firebase Auth Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loginWithEmail calls signInWithEmailAndPassword with correct args', async () => {
    const mockCredential = { user: { uid: '123' } }
    mockSignInWithEmailAndPassword.mockResolvedValue(mockCredential)

    const { loginWithEmail } = await import('./auth')
    const result = await loginWithEmail('test@example.com', 'password123')

    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'test@example.com',
      'password123'
    )
    expect(result).toEqual(mockCredential)
  })

  it('registerWithEmail creates user and updates displayName', async () => {
    const mockUser = { uid: '456', displayName: null }
    const mockCredential = { user: mockUser }
    mockCreateUserWithEmailAndPassword.mockResolvedValue(mockCredential)
    mockUpdateProfile.mockResolvedValue(undefined)

    const { registerWithEmail } = await import('./auth')
    const result = await registerWithEmail('new@example.com', 'password123', 'Juan Perez')

    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'new@example.com',
      'password123'
    )
    expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, {
      displayName: 'Juan Perez',
    })
    expect(result).toEqual(mockCredential)
  })

  it('loginWithGoogle calls signInWithPopup', async () => {
    const mockCredential = { user: { uid: '789' } }
    mockSignInWithPopup.mockResolvedValue(mockCredential)

    const { loginWithGoogle } = await import('./auth')
    const result = await loginWithGoogle()

    expect(mockSignInWithPopup).toHaveBeenCalled()
    expect(result).toEqual(mockCredential)
  })

  it('logout calls signOut', async () => {
    mockSignOut.mockResolvedValue(undefined)

    const { logout } = await import('./auth')
    await logout()

    expect(mockSignOut).toHaveBeenCalled()
  })

  it('sendPasswordReset calls sendPasswordResetEmail', async () => {
    mockSendPasswordResetEmail.mockResolvedValue(undefined)

    const { sendPasswordReset } = await import('./auth')
    await sendPasswordReset('user@example.com')

    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      expect.anything(),
      'user@example.com'
    )
  })
})
