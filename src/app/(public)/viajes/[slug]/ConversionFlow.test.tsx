import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// === Hoisted mocks ===

const { mockTrackEvent, mockPush, mockSearchParams, mockUseAuthStore } = vi.hoisted(() => ({
  mockTrackEvent: vi.fn(),
  mockPush: vi.fn(),
  mockSearchParams: new URLSearchParams(),
  mockUseAuthStore: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: mockTrackEvent,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: mockUseAuthStore,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { ConversionFlow } from './ConversionFlow'
import type { PublicDeparture } from '@/types/trip'

const FUTURE_DATE = '2027-06-15T00:00:00.000Z'
const FUTURE_END_DATE = '2027-07-15T00:00:00.000Z'

function makeDep(overrides: Partial<PublicDeparture> = {}): PublicDeparture {
  return {
    id: 'dep-1',
    odooName: 'Salida Junio',
    startDate: FUTURE_DATE,
    endDate: FUTURE_END_DATE,
    seatsMax: 20,
    seatsAvailable: 15,
    seatsUsed: 5,
    ...overrides,
  }
}

const DEFAULT_PROPS = {
  tripId: 'trip-1',
  tripName: 'Vuelta al Mundo',
  tripSlug: 'vuelta-al-mundo',
  tripPrice: 14500000,
  departures: [makeDep()],
}

const mockSessionStorage: Record<string, string> = {}
const originalSessionStorage = globalThis.sessionStorage

describe('ConversionFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true, isLoading: false })
    // Reset search params
    for (const key of [...mockSearchParams.keys()]) {
      mockSearchParams.delete(key)
    }
    // Mock sessionStorage
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { mockSessionStorage[key] = val }),
      removeItem: vi.fn((key: string) => { delete mockSessionStorage[key] }),
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    for (const key of Object.keys(mockSessionStorage)) delete mockSessionStorage[key]
  })

  it('renders TripDepartures and TripStickyCTA', () => {
    render(<ConversionFlow {...DEFAULT_PROPS} />)
    // TripDepartures heading
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Proximas Salidas')
    // TripStickyCTA buttons
    expect(screen.getByText('Cotizar Ahora')).toBeInTheDocument()
    expect(screen.getByText('Cotizar')).toBeInTheDocument()
  })

  it('opens form when authenticated user clicks CTA', async () => {
    render(<ConversionFlow {...DEFAULT_PROPS} />)

    fireEvent.click(screen.getByText('Cotizar Ahora'))

    await waitFor(() => {
      const titles = screen.getAllByText('Cotizar Viaje')
      expect(titles.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('redirects to login when unauthenticated user clicks CTA', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false, isLoading: false })
    render(<ConversionFlow {...DEFAULT_PROPS} />)

    fireEvent.click(screen.getByText('Cotizar Ahora'))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/login?returnUrl=')
    )
  })

  it('includes slug in returnUrl when redirecting', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false, isLoading: false })
    render(<ConversionFlow {...DEFAULT_PROPS} />)

    fireEvent.click(screen.getByText('Cotizar Ahora'))

    const pushArg = mockPush.mock.calls[0][0] as string
    expect(decodeURIComponent(pushArg)).toContain('/viajes/vuelta-al-mundo')
  })

  it('saves pendingQuote to sessionStorage on redirect', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false, isLoading: false })
    render(<ConversionFlow {...DEFAULT_PROPS} />)

    fireEvent.click(screen.getByText('Cotizar Ahora'))

    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      'pendingQuote',
      expect.any(String)
    )
  })

  it('auto-opens form from URL params after login redirect', async () => {
    mockSearchParams.set('cotizar', 'true')
    mockSearchParams.set('salida', 'dep-1')

    render(<ConversionFlow {...DEFAULT_PROPS} />)

    await waitFor(() => {
      const titles = screen.getAllByText('Cotizar Viaje')
      expect(titles.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('does not auto-open when not authenticated', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false, isLoading: false })
    mockSearchParams.set('cotizar', 'true')

    render(<ConversionFlow {...DEFAULT_PROPS} />)

    expect(screen.queryByText('Cotizar Viaje')).not.toBeInTheDocument()
  })

  it('tracks begin_checkout when CTA is clicked', () => {
    render(<ConversionFlow {...DEFAULT_PROPS} />)
    fireEvent.click(screen.getByText('Cotizar Ahora'))

    expect(mockTrackEvent).toHaveBeenCalledWith('begin_checkout', {
      item_id: 'trip-1',
      item_name: 'Vuelta al Mundo',
    })
  })

  it('tracks select_item when departure is selected', () => {
    render(<ConversionFlow {...DEFAULT_PROPS} />)

    const apartarButtons = screen.getAllByText('Apartar Lugar')
    fireEvent.click(apartarButtons[0])

    expect(mockTrackEvent).toHaveBeenCalledWith('select_item', expect.objectContaining({
      item_id: 'trip-1',
      departure_id: 'dep-1',
    }))
  })
})
