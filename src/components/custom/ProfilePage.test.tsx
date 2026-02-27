import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// vi.hoisted() — mock variables must be declared before vi.mock() factories
// ---------------------------------------------------------------------------
const { mockUseAuthStore } = vi.hoisted(() => ({
  mockUseAuthStore: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Module mocks — evaluated at module resolution time (before imports)
// ---------------------------------------------------------------------------
vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: mockUseAuthStore,
}))

// Mock child sections to avoid deep dependency trees in these focused tests
vi.mock('./ProfilePhotoUpload', () => ({
  ProfilePhotoUpload: ({ displayName }: { displayName: string }) => (
    <div data-testid="photo-upload">{displayName}</div>
  ),
}))

vi.mock('./PersonalDataSection', () => ({
  PersonalDataSection: () => <div data-testid="personal-data-section" />,
}))

vi.mock('./FiscalDataSection', () => ({
  FiscalDataSection: () => <div data-testid="fiscal-data-section" />,
}))

vi.mock('./BankDataSection', () => ({
  BankDataSection: () => <div data-testid="bank-data-section" />,
}))

vi.mock('./NotificationPreferencesSection', () => ({
  NotificationPreferencesSection: () => <div data-testid="notification-preferences-section" />,
}))

vi.mock('@/components/custom/RoleBadge', () => ({
  RoleBadge: ({ role }: { role: string }) => <span data-testid={`role-badge-${role}`}>{role}</span>,
}))

vi.mock('@/components/custom/StatusBadge', () => ({
  StatusBadge: ({ isActive }: { isActive: boolean }) => (
    <span data-testid="status-badge">{isActive ? 'Activo' : 'Inactivo'}</span>
  ),
}))

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------
import type { Timestamp } from 'firebase/firestore'

const FAKE_TIMESTAMP = { seconds: 0, nanoseconds: 0 } as unknown as Timestamp

const BASE_PROFILE = {
  uid: 'user-test-001',
  email: 'test@aroundaplanet.com',
  displayName: 'Ana Gutierrez',
  photoURL: null,
  roles: ['cliente'] as import('@/types/user').UserRole[],
  isActive: true,
  provider: 'email' as const,
  createdAt: FAKE_TIMESTAMP,
  updatedAt: FAKE_TIMESTAMP,
  lastLoginAt: FAKE_TIMESTAMP,
  firstName: 'Ana',
  lastName: 'Gutierrez',
}

function makeAuthState(overrides: Partial<{
  isLoading: boolean
  profile: typeof BASE_PROFILE | null
  claims: { roles: import('@/types/user').UserRole[] } | null
}> = {}) {
  return {
    isLoading: false,
    profile: BASE_PROFILE,
    claims: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Module warmup — imported after mocks are in place
// ---------------------------------------------------------------------------
let ProfilePage: typeof import('./ProfilePage').ProfilePage

beforeEach(async () => {
  const mod = await import('./ProfilePage')
  ProfilePage = mod.ProfilePage
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.resetModules()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ProfilePage', () => {
  it('shows skeleton when loading', () => {
    mockUseAuthStore.mockReturnValue(makeAuthState({ isLoading: true, profile: null }))

    vi.stubGlobal('fetch', vi.fn())

    render(<ProfilePage />)

    // Loading state renders multiple Skeleton elements (no photo-upload, no displayName h1)
    const skeletons = document.querySelectorAll('[class*="skeleton"], [data-slot="skeleton"]')
    // The component renders 6 skeletons in loading state — just assert some exist
    // We verify that the displayName and photo-upload are NOT shown
    expect(screen.queryByTestId('photo-upload')).not.toBeInTheDocument()
    expect(screen.queryByText('Ana Gutierrez')).not.toBeInTheDocument()
    // And that skeleton containers exist
    expect(document.querySelector('.space-y-6')).toBeInTheDocument()
    // Also assert by role — Skeleton uses a div with animate-pulse
    const animatedEls = document.querySelectorAll('[class*="animate-pulse"], .animate-pulse')
    expect(animatedEls.length).toBeGreaterThan(0)
  })

  it('renders user displayName when profile loaded', async () => {
    mockUseAuthStore.mockReturnValue(makeAuthState())

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: null }),
    }))

    render(<ProfilePage />)

    // The displayName appears in the <h1> heading and also inside the mocked
    // ProfilePhotoUpload div, so use getAllByText and assert at least one match.
    const matches = screen.getAllByText('Ana Gutierrez')
    expect(matches.length).toBeGreaterThan(0)
    // Specifically verify the <h1> heading renders the displayName
    const heading = matches.find((el) => el.tagName === 'H1')
    expect(heading).toBeInTheDocument()
  })

  it('does NOT render bank data section for non-agent users (roles: [cliente])', async () => {
    mockUseAuthStore.mockReturnValue(
      makeAuthState({
        profile: { ...BASE_PROFILE, roles: ['cliente'] },
        claims: { roles: ['cliente'] },
      })
    )

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: null }),
    }))

    render(<ProfilePage />)

    // Wait for preferences fetch to settle so the section has had a chance to appear
    await waitFor(() => {
      expect(screen.queryByTestId('bank-data-section')).not.toBeInTheDocument()
    })
  })

  it('renders bank data section for agent users (roles: [agente])', async () => {
    mockUseAuthStore.mockReturnValue(
      makeAuthState({
        profile: { ...BASE_PROFILE, roles: ['agente'] },
        claims: { roles: ['agente'] },
      })
    )

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: null }),
    }))

    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByTestId('bank-data-section')).toBeInTheDocument()
    })
  })
})
