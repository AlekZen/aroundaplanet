import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TripHero } from './TripHero'
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
    emotionalCopy: '33.8 dias alrededor del planeta',
    tags: [],
    highlights: [],
    difficulty: null,
    seoTitle: '',
    seoDescription: '',
    heroImages: ['https://storage.googleapis.com/test/hero.webp'],
    isPublished: true,
    nextDepartureDate: null,
    totalDepartures: 0,
    totalSeatsAvailable: 0,
    totalSeatsMax: 0,
    ...overrides,
  }
}

describe('TripHero', () => {
  it('renders trip name as h1', () => {
    render(<TripHero trip={makeTrip()} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Vuelta al Mundo')
  })

  it('renders formatted price', () => {
    render(<TripHero trip={makeTrip()} />)
    // formatCurrency(14500000) → "$145,000"
    expect(screen.getByText(/\$145,000/)).toBeInTheDocument()
  })

  it('renders emotional copy when present', () => {
    render(<TripHero trip={makeTrip({ emotionalCopy: 'Viaje de tu vida' })} />)
    expect(screen.getByText('Viaje de tu vida')).toBeInTheDocument()
  })

  it('does not render emotional copy when empty', () => {
    render(<TripHero trip={makeTrip({ emotionalCopy: '' })} />)
    expect(screen.queryByText('33.8 dias alrededor del planeta')).not.toBeInTheDocument()
  })

  it('renders category badge when present', () => {
    render(<TripHero trip={makeTrip({ odooCategory: 'Europa' })} />)
    expect(screen.getByText('Europa')).toBeInTheDocument()
  })

  it('does not render category badge when empty', () => {
    render(<TripHero trip={makeTrip({ odooCategory: '' })} />)
    expect(screen.queryByText('Internacional')).not.toBeInTheDocument()
  })

  it('has descriptive alt text on hero image', () => {
    render(<TripHero trip={makeTrip()} />)
    expect(screen.getByAltText('Vuelta al Mundo — viaje AroundaPlanet')).toBeInTheDocument()
  })

  it('has accessible section label', () => {
    render(<TripHero trip={makeTrip()} />)
    expect(screen.getByLabelText(/imagen principal/)).toBeInTheDocument()
  })
})
