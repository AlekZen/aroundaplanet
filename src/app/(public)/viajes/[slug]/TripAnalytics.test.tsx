import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

const { mockTrackEvent } = vi.hoisted(() => ({
  mockTrackEvent: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: mockTrackEvent,
}))

import { TripAnalytics } from './TripAnalytics'
import type { PublicTrip } from '@/types/trip'

function makeTrip(overrides: Partial<PublicTrip> = {}): PublicTrip {
  return {
    id: 'trip-1',
    odooName: 'Vuelta al Mundo',
    odooListPriceCentavos: 14500000,
    odooCurrencyCode: 'MXN',
    odooCategory: 'Internacional',
    odooDescriptionSale: '',
    odooRatingAvg: 0,
    odooRatingCount: 0,
    slug: 'vuelta-al-mundo',
    emotionalCopy: '',
    tags: [],
    highlights: [],
    difficulty: null,
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

describe('TripAnalytics', () => {
  it('fires view_item event on mount', () => {
    render(<TripAnalytics trip={makeTrip()} />)

    expect(mockTrackEvent).toHaveBeenCalledWith('view_item', {
      item_id: 'trip-1',
      item_name: 'Vuelta al Mundo',
      price: 145000,
      currency: 'MXN',
      item_category: 'Internacional',
    })
  })

  it('renders nothing visible', () => {
    const { container } = render(<TripAnalytics trip={makeTrip()} />)
    expect(container.firstChild).toBeNull()
  })

  it('includes correct price (centavos to MXN)', () => {
    render(<TripAnalytics trip={makeTrip({ odooListPriceCentavos: 8000000 })} />)

    expect(mockTrackEvent).toHaveBeenCalledWith(
      'view_item',
      expect.objectContaining({ price: 80000 })
    )
  })
})
