import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { TripEditPanel } from './TripEditPanel'

// === Mocks ===

const mockPush = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ tripId: 'trip-1' }),
  usePathname: () => '/admin/trips/trip-1',
}))

const mockSave = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/useAutoSave', () => ({
  useAutoSave: () => ({ save: mockSave }),
}))

const mockGenerateSlug = vi.hoisted(() => vi.fn((name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
))
vi.mock('@/lib/utils/slugify', () => ({
  generateSlug: mockGenerateSlug,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props
    return <img {...rest} data-fill={fill ? 'true' : undefined} />
  },
}))

// === Test data ===

const MOCK_TRIP = {
  id: 'trip-1',
  odooName: 'VUELTA AL MUNDO 2026',
  odooListPriceCentavos: 14500000,
  odooCurrencyCode: 'MXN',
  odooCategory: 'Premium',
  odooDescriptionSale: 'Viaje completo alrededor del mundo',
  odooRatingCount: 0,
  odooRatingAvg: 0,
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
  documents: [],
  departures: [],
}

function mockTripResponse(trip: Record<string, unknown> = MOCK_TRIP) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(trip),
  })
}

// === Tests ===

describe('TripEditPanel', () => {
  beforeEach(() => {
    mockPush.mockReset()
    mockSave.mockReset()
    mockGenerateSlug.mockReset()
    mockGenerateSlug.mockImplementation((name: string) =>
      name.toLowerCase().replace(/\s+/g, '-')
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows skeleton while loading', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<TripEditPanel />)

    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders trip info after fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripResponse()))
    render(<TripEditPanel />)

    await waitFor(() => {
      expect(screen.getAllByText('VUELTA AL MUNDO 2026').length).toBeGreaterThan(0)
    }, { timeout: 2000 })

    // Price shown in sidebar Datos Odoo section
    expect(screen.getAllByText('$145,000').length).toBeGreaterThan(0)
    // Category shown
    expect(screen.getAllByText('Premium').length).toBeGreaterThan(0)
  })

  it('shows creative prompt when 0 editorial fields completed', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripResponse()))
    render(<TripEditPanel />)

    await waitFor(() => {
      expect(screen.getByText('Este viaje necesita tu toque creativo')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('shows completeness progress when some fields filled', async () => {
    const partialTrip = {
      ...MOCK_TRIP,
      slug: 'vuelta-al-mundo-2026',
      emotionalCopy: 'Un viaje inolvidable',
      tags: ['aventura'],
    }
    vi.stubGlobal('fetch', vi.fn(() => mockTripResponse(partialTrip)))
    render(<TripEditPanel />)

    await waitFor(() => {
      expect(screen.getByText('3/7 campos completados')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('auto-generates slug on button click', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripResponse()))
    render(<TripEditPanel />)

    await waitFor(() => {
      expect(screen.getByText('Auto')).toBeInTheDocument()
    }, { timeout: 2000 })

    fireEvent.click(screen.getByText('Auto'))

    expect(mockGenerateSlug).toHaveBeenCalledWith('VUELTA AL MUNDO 2026')
    expect(mockSave).toHaveBeenCalledWith({ slug: 'vuelta-al-mundo-2026' })
  })

  it('calls save on editorial field change', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripResponse()))
    render(<TripEditPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Copy Emocional')).toBeInTheDocument()
    }, { timeout: 2000 })

    const textarea = screen.getByLabelText('Copy Emocional')
    fireEvent.change(textarea, { target: { value: 'Un viaje magico' } })

    expect(mockSave).toHaveBeenCalledWith({ emotionalCopy: 'Un viaje magico' })
  })

  it('shows unpublish confirmation dialog when toggling off published trip', async () => {
    const publishedTrip = { ...MOCK_TRIP, isPublished: true }
    vi.stubGlobal('fetch', vi.fn(() => mockTripResponse(publishedTrip)))
    render(<TripEditPanel />)

    await waitFor(() => {
      expect(screen.getByText('Publicado')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Click the publish switch to unpublish (only switch on page — no departures)
    const publishSwitch = screen.getByRole('switch')
    fireEvent.click(publishSwitch)

    // Confirmation dialog appears
    await waitFor(() => {
      expect(screen.getByText('Despublicar viaje')).toBeInTheDocument()
    }, { timeout: 2000 })
    expect(screen.getByText(/dejara de aparecer/i)).toBeInTheDocument()
  })

  it('shows empty departures message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockTripResponse()))
    render(<TripEditPanel />)

    await waitFor(() => {
      expect(screen.getByText(/no hay salidas/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('shows error state for failed fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ message: 'Viaje no encontrado' }),
    })))
    render(<TripEditPanel />)

    await waitFor(() => {
      expect(screen.getByText('Viaje no encontrado')).toBeInTheDocument()
    }, { timeout: 2000 })

    expect(screen.getByText('Reintentar')).toBeInTheDocument()
  })
})
