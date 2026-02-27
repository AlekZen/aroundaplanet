import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { TripListPanel } from './TripListPanel'

// === Mocks ===

const mockPush = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/admin/trips',
}))

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props
    return <img {...rest} data-fill={fill ? 'true' : undefined} />
  },
}))

// === Helpers ===

const MOCK_TRIPS = [
  {
    id: 'trip-1',
    odooName: 'VUELTA AL MUNDO 2026',
    odooListPriceCentavos: 14500000,
    odooCurrencyCode: 'MXN',
    odooCategory: 'Premium',
    isPublished: true,
    isActive: true,
    slug: 'vuelta-al-mundo-2026',
    emotionalCopy: 'Un viaje inolvidable',
    tags: ['aventura', 'premium'],
    highlights: ['33 dias'],
    difficulty: 'moderate',
    seoTitle: 'Vuelta al Mundo',
    seoDescription: '',
    heroImages: [],
    hasOdooImage: true,
    odooProductId: 1515,
    odooSalesCount: 3,
    odooIsFavorite: true,
    odooDocumentCount: 5,
    lastSyncAt: { _seconds: 1740000000 },
    nextDepartureDate: { _seconds: 1772000000 },
    nextDepartureEndDate: { _seconds: 1775000000 },
    totalDepartures: 2,
    totalSeatsMax: 60,
    totalSeatsAvailable: 12,
  },
  {
    id: 'trip-2',
    odooName: 'EUROPA CLASICA 2026',
    odooListPriceCentavos: 8500000,
    odooCurrencyCode: 'MXN',
    odooCategory: '',
    isPublished: false,
    isActive: true,
    slug: '',
    emotionalCopy: '',
    tags: [],
    highlights: [],
    difficulty: null,
    seoTitle: '',
    seoDescription: '',
    heroImages: [],
    hasOdooImage: false,
    odooProductId: null,
    odooSalesCount: 0,
    odooIsFavorite: false,
    odooDocumentCount: 0,
    lastSyncAt: null,
    nextDepartureDate: null,
    nextDepartureEndDate: null,
    totalDepartures: 0,
    totalSeatsMax: 0,
    totalSeatsAvailable: 0,
  },
]

function mockTripsResponse(trips: Array<Record<string, unknown>> = [], total?: number) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      trips,
      nextCursor: null,
      total: total ?? trips.length,
    }),
  })
}

// === Tests ===

describe('TripListPanel', () => {
  beforeEach(() => {
    mockPush.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows skeleton while loading', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<TripListPanel />)

    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders trip list after fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripsResponse(MOCK_TRIPS, 2)))

    render(<TripListPanel />)

    await waitFor(() => {
      expect(screen.getAllByText('VUELTA AL MUNDO 2026').length).toBeGreaterThan(0)
    }, { timeout: 2000 })

    expect(screen.getAllByText('EUROPA CLASICA 2026').length).toBeGreaterThan(0)
  })

  it('shows summary stat cards', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripsResponse(MOCK_TRIPS, 2)))

    render(<TripListPanel />)

    await waitFor(() => {
      expect(screen.getByText('Total viajes')).toBeInTheDocument()
    }, { timeout: 2000 })

    // "Publicados" and "Borradores" appear in both stat cards and filter buttons
    expect(screen.getAllByText('Publicados').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Borradores').length).toBeGreaterThan(0)
    expect(screen.getByText('Con imagenes')).toBeInTheDocument()
  })

  it('shows empty state when no trips returned', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripsResponse([], 0)))

    render(<TripListPanel />)

    await waitFor(() => {
      expect(screen.getByText(/no hay viajes sincronizados/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('shows error state with retry on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ message: 'Error de servidor' }),
    })))

    render(<TripListPanel />)

    await waitFor(() => {
      expect(screen.getByText('Error de servidor')).toBeInTheDocument()
    }, { timeout: 2000 })

    expect(screen.getByText('Reintentar')).toBeInTheDocument()
  })

  it('navigates to edit page on row click', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripsResponse(MOCK_TRIPS, 2)))

    render(<TripListPanel />)

    await waitFor(() => {
      expect(screen.getAllByText('VUELTA AL MUNDO 2026').length).toBeGreaterThan(0)
    }, { timeout: 2000 })

    // Click on the trip name text in the desktop table (first occurrence)
    fireEvent.click(screen.getAllByText('VUELTA AL MUNDO 2026')[0])

    expect(mockPush).toHaveBeenCalledWith('/admin/trips/trip-1')
  })

  it('renders filter chips', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripsResponse([], 0)))

    render(<TripListPanel />)

    await waitFor(() => {
      expect(screen.getByText('Todos')).toBeInTheDocument()
    }, { timeout: 2000 })

    // "Publicados" appears both as filter chip and stat label — just check it exists
    expect(screen.getAllByText('Publicados').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Borradores').length).toBeGreaterThan(0)
    expect(screen.getByText('Con Salidas')).toBeInTheDocument()
  })

  it('renders search input', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripsResponse([], 0)))

    render(<TripListPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Buscar viajes')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('shows published and draft badges', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripsResponse(MOCK_TRIPS, 2)))

    render(<TripListPanel />)

    await waitFor(() => {
      expect(screen.getAllByText('Publicado').length).toBeGreaterThan(0)
    }, { timeout: 2000 })

    expect(screen.getAllByText('Borrador').length).toBeGreaterThan(0)
  })

  it('shows editorial completeness progress', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripsResponse(MOCK_TRIPS, 2)))

    render(<TripListPanel />)

    await waitFor(() => {
      // Trip 1 has 6/7 fields filled (slug, emotionalCopy, tags, highlights, difficulty, seoTitle; missing seoDescription)
      // Trip 2 has 0/7 fields filled
      expect(screen.getAllByText('6/7').length).toBeGreaterThan(0)
      expect(screen.getAllByText('0/7').length).toBeGreaterThan(0)
    }, { timeout: 2000 })
  })

  it('shows category info', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripsResponse(MOCK_TRIPS, 2)))

    render(<TripListPanel />)

    await waitFor(() => {
      expect(screen.getAllByText('Premium').length).toBeGreaterThan(0)
    }, { timeout: 2000 })
  })

  it('shows tag badges', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripsResponse(MOCK_TRIPS, 2)))

    render(<TripListPanel />)

    await waitFor(() => {
      expect(screen.getAllByText('aventura').length).toBeGreaterThan(0)
      expect(screen.getAllByText('premium').length).toBeGreaterThan(0)
    }, { timeout: 2000 })
  })

  it('shows next departure date and seats for trip with departures', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripsResponse(MOCK_TRIPS, 2)))

    render(<TripListPanel />)

    await waitFor(() => {
      // Trip 1 has 48/60 seats occupied (totalSeatsMax=60, totalSeatsAvailable=12)
      expect(screen.getAllByText('48/60').length).toBeGreaterThan(0)
    }, { timeout: 2000 })

    // Trip 2 has no departures — should show "Sin salidas"
    expect(screen.getAllByText('Sin salidas').length).toBeGreaterThan(0)
  })
})
