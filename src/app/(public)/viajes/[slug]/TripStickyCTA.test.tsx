import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockTrackEvent } = vi.hoisted(() => ({
  mockTrackEvent: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: mockTrackEvent,
}))

import { TripStickyCTA } from './TripStickyCTA'

describe('TripStickyCTA', () => {
  it('renders desktop CTA button', () => {
    render(<TripStickyCTA tripId="t1" tripName="Test Trip" />)
    expect(screen.getByText('Cotizar Ahora')).toBeInTheDocument()
  })

  it('renders mobile CTA button', () => {
    render(<TripStickyCTA tripId="t1" tripName="Test Trip" />)
    expect(screen.getByText('Cotizar')).toBeInTheDocument()
  })

  it('tracks begin_checkout on CTA click', () => {
    render(<TripStickyCTA tripId="t1" tripName="Test Trip" />)

    fireEvent.click(screen.getByText('Cotizar Ahora'))

    expect(mockTrackEvent).toHaveBeenCalledWith('begin_checkout', {
      item_id: 't1',
      item_name: 'Test Trip',
    })
  })

  it('CTA links to login page', () => {
    render(<TripStickyCTA tripId="t1" tripName="Test Trip" />)
    const links = screen.getAllByRole('link')
    expect(links.some((l) => l.getAttribute('href') === '/login')).toBe(true)
  })

  it('has accessible label on mobile CTA container', () => {
    render(<TripStickyCTA tripId="t1" tripName="Test Trip" />)
    expect(screen.getByLabelText('Accion principal')).toBeInTheDocument()
  })
})
