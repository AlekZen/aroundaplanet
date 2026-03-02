import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock firebase/app
vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({})),
}))

const mockSetDoc = vi.fn()
const mockGetDoc = vi.fn()
const mockDoc = vi.fn(() => 'mock-doc-ref')
const mockServerTimestamp = vi.fn(() => 'mock-timestamp')

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  serverTimestamp: mockServerTimestamp,
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
}))

describe('Firestore User Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createUserProfile creates new doc for first-time user', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })
    mockSetDoc.mockResolvedValue(undefined)

    const { createUserProfile } = await import('./firestore')
    const mockUser = {
      uid: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    await createUserProfile(mockUser, 'email')

    expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', {
      uid: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: null,
      roles: ['cliente'],
      isActive: true,
      provider: 'email',
      createdAt: 'mock-timestamp',
      updatedAt: 'mock-timestamp',
      lastLoginAt: 'mock-timestamp',
    })
  })

  it('createUserProfile merges lastLoginAt for existing user', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true })
    mockSetDoc.mockResolvedValue(undefined)

    const { createUserProfile } = await import('./firestore')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockUser = { uid: 'user-123', email: 'test@example.com', displayName: 'Test', photoURL: null } as any

    await createUserProfile(mockUser, 'google')

    expect(mockSetDoc).toHaveBeenCalledWith(
      'mock-doc-ref',
      { lastLoginAt: 'mock-timestamp', updatedAt: 'mock-timestamp' },
      { merge: true }
    )
  })

  it('getUserProfile returns profile data for existing user', async () => {
    const profileData = {
      uid: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: null,
      roles: ['cliente'],
      isActive: true,
      provider: 'email',
      createdAt: 'mock-timestamp',
      updatedAt: 'mock-timestamp',
      lastLoginAt: 'mock-timestamp',
    }
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => profileData,
    })

    const { getUserProfile } = await import('./firestore')
    const result = await getUserProfile('user-123')

    expect(result).toEqual(profileData)
  })

  it('getUserProfile returns null for non-existent user', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })

    const { getUserProfile } = await import('./firestore')
    const result = await getUserProfile('non-existent')

    expect(result).toBeNull()
  })

  it('createUserProfile stores attribution data when provided', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })
    mockSetDoc.mockResolvedValue(undefined)

    const { createUserProfile } = await import('./firestore')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockUser = { uid: 'user-456', email: 'new@test.com', displayName: 'New User', photoURL: null } as any

    await createUserProfile(mockUser, 'email', {
      assignedAgentId: 'agent-lupita',
      utmSource: 'facebook',
      utmMedium: 'social',
      utmCampaign: 'spring-2026',
    })

    expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
      uid: 'user-456',
      assignedAgentId: 'agent-lupita',
      attributionSource: {
        utmSource: 'facebook',
        utmMedium: 'social',
        utmCampaign: 'spring-2026',
      },
    }))
  })

  it('createUserProfile omits attribution fields when not provided', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })
    mockSetDoc.mockResolvedValue(undefined)

    const { createUserProfile } = await import('./firestore')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockUser = { uid: 'user-789', email: 'plain@test.com', displayName: 'Plain', photoURL: null } as any

    await createUserProfile(mockUser, 'google')

    const calledWith = mockSetDoc.mock.calls[0][1]
    expect(calledWith).not.toHaveProperty('assignedAgentId')
    expect(calledWith).not.toHaveProperty('attributionSource')
  })

  it('updateLastLogin merges timestamp fields', async () => {
    mockSetDoc.mockResolvedValue(undefined)

    const { updateLastLogin } = await import('./firestore')
    await updateLastLogin('user-123')

    expect(mockSetDoc).toHaveBeenCalledWith(
      'mock-doc-ref',
      { lastLoginAt: 'mock-timestamp', updatedAt: 'mock-timestamp' },
      { merge: true }
    )
  })
})
