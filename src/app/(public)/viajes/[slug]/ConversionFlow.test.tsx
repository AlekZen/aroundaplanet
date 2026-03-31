import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// === Hoisted mocks ===

const { mockTrackEvent, mockSearchParams, mockUseAuthStore, mockRouterPush } = vi.hoisted(() => ({
  mockTrackEvent: vi.fn(),
  mockSearchParams: new URLSearchParams(),
  mockUseAuthStore: vi.fn(),
  mockRouterPush: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: mockTrackEvent,
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: mockRouterPush }),
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

describe('ConversionFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null, profile: null })
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

  it('opens form when guest clicks CTA', async () => {
    render(<ConversionFlow {...DEFAULT_PROPS} />)

    fireEvent.click(screen.getByText('Cotizar Ahora'))

    await waitFor(() => {
      const titles = screen.getAllByText('Cotizar Viaje')
      expect(titles.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('calls handleAuthEnroll when authenticated user clicks CTA (no form)', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { displayName: 'Juan', email: 'juan@test.com' },
      profile: { displayName: 'Juan Perez' },
    })
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        orderId: 'order-1',
        tripId: 'trip-1',
        status: 'Interesado',
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ConversionFlow {...DEFAULT_PROPS} />)

    fireEvent.click(screen.getByText('Cotizar Ahora'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/orders', expect.objectContaining({ method: 'POST' }))
    })
  })

  it('auto-opens form from URL params for guests', async () => {
    mockSearchParams.set('cotizar', 'true')
    mockSearchParams.set('salida', 'dep-1')

    render(<ConversionFlow {...DEFAULT_PROPS} />)

    await waitFor(() => {
      const titles = screen.getAllByText('Cotizar Viaje')
      expect(titles.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('does not render ConversionForm for authenticated users', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { displayName: 'Juan' },
      profile: null,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ orderId: 'x', tripId: 'trip-1', status: 'Interesado' }),
    }))

    render(<ConversionFlow {...DEFAULT_PROPS} />)

    // ConversionForm is not rendered for authenticated users
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
