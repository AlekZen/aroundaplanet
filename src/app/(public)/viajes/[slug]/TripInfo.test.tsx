import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TripInfo } from './TripInfo'
import type { PublicTrip } from '@/types/trip'

function makeTrip(overrides: Partial<PublicTrip> = {}): PublicTrip {
  return {
    id: 'trip-1',
    odooName: 'Test Trip',
    odooListPriceCentavos: 5000000,
    odooCurrencyCode: 'MXN',
    odooCategory: 'Europa',
    odooDescriptionSale: 'Desc',
    odooRatingAvg: 0,
    odooRatingCount: 0,
    slug: 'test-trip',
    emotionalCopy: '',
    tags: ['aventura', 'cultura'],
    highlights: ['Vuelos incluidos', 'Guia local'],
    difficulty: 'moderate',
    seoTitle: '',
    seoDescription: '',
    heroImages: [],
    isPublished: true,
    nextDepartureDate: null,
    totalDepartures: 0,
    totalSeatsAvailable: 0,
    totalSeatsMax: 0,
    ...overrides,
  }
}

describe('TripInfo', () => {
  it('renders highlights as list items', () => {
    render(<TripInfo trip={makeTrip()} />)
    expect(screen.getByText('Vuelos incluidos')).toBeInTheDocument()
    expect(screen.getByText('Guia local')).toBeInTheDocument()
  })

  it('renders tags as badges', () => {
    render(<TripInfo trip={makeTrip()} />)
    expect(screen.getByText('aventura')).toBeInTheDocument()
    expect(screen.getByText('cultura')).toBeInTheDocument()
  })

  it('renders difficulty badge with translated label', () => {
    render(<TripInfo trip={makeTrip({ difficulty: 'moderate' })} />)
    expect(screen.getByText('Moderado')).toBeInTheDocument()
  })

  it('renders difficulty easy as Facil', () => {
    render(<TripInfo trip={makeTrip({ difficulty: 'easy' })} />)
    expect(screen.getByText('Facil')).toBeInTheDocument()
  })

  it('renders difficulty challenging as Desafiante', () => {
    render(<TripInfo trip={makeTrip({ difficulty: 'challenging' })} />)
    expect(screen.getByText('Desafiante')).toBeInTheDocument()
  })

  it('returns null when no highlights, tags, or difficulty', () => {
    const { container } = render(
      <TripInfo trip={makeTrip({ highlights: [], tags: [], difficulty: null })} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('omits highlights section when empty', () => {
    render(<TripInfo trip={makeTrip({ highlights: [] })} />)
    expect(screen.queryByText('Lo que incluye')).not.toBeInTheDocument()
  })

  it('has accessible section label', () => {
    render(<TripInfo trip={makeTrip()} />)
    expect(screen.getByLabelText('Informacion del viaje')).toBeInTheDocument()
  })
})
