import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockSearchParams, mockReplace, mockTrackEvent } = vi.hoisted(() => ({
  mockSearchParams: { current: new URLSearchParams() },
  mockReplace: vi.fn(),
  mockTrackEvent: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams.current,
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/viajes',
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: mockTrackEvent,
}))

vi.mock('framer-motion', () => ({
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  useReducedMotion: () => true,
}))

import { CatalogContent } from './CatalogContent'
import type { PublicTrip } from '@/types/trip'

function makeTrip(overrides: Partial<PublicTrip> = {}): PublicTrip {
  return {
    id: 'trip-1',
    odooName: 'Vuelta al Mundo',
    odooListPriceCentavos: 14500000,
    odooCurrencyCode: 'MXN',
    odooCategory: 'Internacional',
    odooDescriptionSale: 'Viaje increible',
    odooRatingAvg: 0,
    odooRatingCount: 0,
    slug: 'vuelta-al-mundo',
    emotionalCopy: '',
    tags: [],
    highlights: [],
    difficulty: null,
    seoTitle: '',
    seoDescription: '',
    heroImages: ['/test.webp'],
    isPublished: true,
    nextDepartureDate: '2026-03-01T00:00:00.000Z',
    totalDepartures: 3,
    totalSeatsAvailable: 10,
    totalSeatsMax: 20,
    ...overrides,
  }
}

describe('CatalogContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.current = new URLSearchParams()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders trip cards in a grid', () => {
    const trips = [
      makeTrip({ id: 't1', odooName: 'Trip A', slug: 'trip-a' }),
      makeTrip({ id: 't2', odooName: 'Trip B', slug: 'trip-b' }),
    ]

    render(<CatalogContent trips={trips} />)

    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getByText('Trip A')).toBeInTheDocument()
    expect(screen.getByText('Trip B')).toBeInTheDocument()
  })

  it('shows destination filter chips from unique categories', () => {
    const trips = [
      makeTrip({ id: 't1', odooCategory: 'Europa' }),
      makeTrip({ id: 't2', odooCategory: 'Asia' }),
      makeTrip({ id: 't3', odooCategory: 'Europa' }),
    ]

    render(<CatalogContent trips={trips} />)

    expect(screen.getByText('Destino:')).toBeInTheDocument()
    // Destination text appears in both filter chips and TripCard badges
    expect(screen.getAllByText('Asia').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Europa').length).toBeGreaterThanOrEqual(1)
  })

  it('shows price range filter chips', () => {
    render(<CatalogContent trips={[makeTrip()]} />)

    expect(screen.getByText('Precio:')).toBeInTheDocument()
    expect(screen.getByText('Hasta $50K')).toBeInTheDocument()
  })

  it('shows departure month chips from trips', () => {
    const trips = [
      makeTrip({ id: 't1', nextDepartureDate: '2026-03-01T00:00:00.000Z' }),
      makeTrip({ id: 't2', nextDepartureDate: '2026-06-15T00:00:00.000Z' }),
    ]

    render(<CatalogContent trips={trips} />)

    expect(screen.getByText('Salida:')).toBeInTheDocument()
  })

  it('shows sold-out badge on trips with no available seats', () => {
    const trips = [
      makeTrip({ id: 't1', odooName: 'Sold Out Trip', totalSeatsAvailable: 0, totalDepartures: 2 }),
    ]

    render(<CatalogContent trips={trips} />)

    const agotados = screen.getAllByText('Agotado')
    expect(agotados.length).toBeGreaterThanOrEqual(1)
  })

  it('shows empty state when no trips provided', () => {
    render(<CatalogContent trips={[]} />)

    expect(screen.getByText('Pronto habra nuevas aventuras disponibles')).toBeInTheDocument()
  })

  it('fires view_item_list analytics event on mount', () => {
    const trips = [makeTrip()]
    render(<CatalogContent trips={trips} />)

    expect(mockTrackEvent).toHaveBeenCalledWith('view_item_list', expect.objectContaining({
      item_list_name: 'trip_catalog',
    }))
  })

  it('formats price from centavos', () => {
    const trips = [makeTrip({ odooListPriceCentavos: 14500000 })]
    render(<CatalogContent trips={trips} />)

    expect(screen.getByText(/145,000|145\.000/)).toBeInTheDocument()
  })

  it('shows "Proximamente" when no departure date', () => {
    const trips = [makeTrip({ nextDepartureDate: null })]
    render(<CatalogContent trips={trips} />)

    expect(screen.getByText('Proximamente')).toBeInTheDocument()
  })

  it('renders Cotizar CTA for public variant', () => {
    const trips = [makeTrip()]
    render(<CatalogContent trips={trips} />)

    expect(screen.getByText('Cotizar')).toBeInTheDocument()
  })

  it('filters trips by destination when destino param is set', () => {
    mockSearchParams.current = new URLSearchParams('destino=Europa')
    const trips = [
      makeTrip({ id: 't1', odooName: 'Trip Europa', odooCategory: 'Europa', slug: 'europa' }),
      makeTrip({ id: 't2', odooName: 'Trip Asia', odooCategory: 'Asia', slug: 'asia' }),
    ]

    render(<CatalogContent trips={trips} />)

    const articles = screen.getAllByRole('article')
    expect(articles).toHaveLength(1)
    expect(screen.getByText('Trip Europa')).toBeInTheDocument()
    expect(screen.queryByText('Trip Asia')).not.toBeInTheDocument()
  })

  it('filters trips by price range when precio param is set', () => {
    mockSearchParams.current = new URLSearchParams('precio=Hasta+%2450K')
    const trips = [
      makeTrip({ id: 't1', odooName: 'Cheap', odooListPriceCentavos: 3_000_000, slug: 'cheap' }),
      makeTrip({ id: 't2', odooName: 'Expensive', odooListPriceCentavos: 15_000_000, slug: 'expensive' }),
    ]

    render(<CatalogContent trips={trips} />)

    const articles = screen.getAllByRole('article')
    expect(articles).toHaveLength(1)
    expect(screen.getByText('Cheap')).toBeInTheDocument()
    expect(screen.queryByText('Expensive')).not.toBeInTheDocument()
  })

  it('filters trips by AND logic (destination + price)', () => {
    mockSearchParams.current = new URLSearchParams('destino=Europa&precio=Hasta+%2450K')
    const trips = [
      makeTrip({ id: 't1', odooName: 'Europa Cheap', odooCategory: 'Europa', odooListPriceCentavos: 3_000_000, slug: 'ec' }),
      makeTrip({ id: 't2', odooName: 'Europa Expensive', odooCategory: 'Europa', odooListPriceCentavos: 15_000_000, slug: 'ee' }),
      makeTrip({ id: 't3', odooName: 'Asia Cheap', odooCategory: 'Asia', odooListPriceCentavos: 3_000_000, slug: 'ac' }),
    ]

    render(<CatalogContent trips={trips} />)

    const articles = screen.getAllByRole('article')
    expect(articles).toHaveLength(1)
    expect(screen.getByText('Europa Cheap')).toBeInTheDocument()
  })

  it('does not fire select_item for sold-out card clicks', () => {
    const trips = [
      makeTrip({ id: 't1', odooName: 'Sold Out', totalSeatsAvailable: 0, totalDepartures: 2, slug: 'sold-out' }),
    ]

    render(<CatalogContent trips={trips} />)

    // Click the list item containing the sold-out card
    const article = screen.getByRole('article')
    article.click()

    // select_item should NOT have fired (view_item_list fires on mount, but not select_item)
    const selectCalls = mockTrackEvent.mock.calls.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any[]) => call[0] === 'select_item'
    )
    expect(selectCalls).toHaveLength(0)
  })
})
