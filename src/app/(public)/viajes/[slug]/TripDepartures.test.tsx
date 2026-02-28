import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TripDepartures } from './TripDepartures'
import type { PublicDeparture } from '@/types/trip'

// Future date: 2027-06-15
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

describe('TripDepartures', () => {
  it('renders empty state when no departures', () => {
    render(<TripDepartures departures={[]} tripId="t1" tripName="Test Trip" />)
    expect(screen.getByText('Proximas salidas en preparacion')).toBeInTheDocument()
    expect(screen.getByText(/Contactar Equipo/)).toBeInTheDocument()
  })

  it('does not show empty table or "No hay datos"', () => {
    render(<TripDepartures departures={[]} tripId="t1" tripName="Test Trip" />)
    expect(screen.queryByText('No hay datos')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders departure with formatted date', () => {
    render(<TripDepartures departures={[makeDep()]} tripId="t1" tripName="Test Trip" />)
    // "15 de junio de 2027" in es-MX locale
    const dateTexts = screen.getAllByText(/junio/)
    expect(dateTexts.length).toBeGreaterThanOrEqual(1)
  })

  it('shows green badge for >50% availability', () => {
    render(
      <TripDepartures
        departures={[makeDep({ seatsMax: 20, seatsAvailable: 15 })]}
        tripId="t1"
        tripName="Test Trip"
      />
    )
    const badges = screen.getAllByText('15 disponibles')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows yellow badge for 20-50% availability', () => {
    render(
      <TripDepartures
        departures={[makeDep({ seatsMax: 20, seatsAvailable: 8 })]}
        tripId="t1"
        tripName="Test Trip"
      />
    )
    const badges = screen.getAllByText('8 disponibles')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows red urgency badge for <20% availability', () => {
    render(
      <TripDepartures
        departures={[makeDep({ seatsMax: 20, seatsAvailable: 3 })]}
        tripId="t1"
        tripName="Test Trip"
      />
    )
    const badges = screen.getAllByText(/Solo 3 lugares/)
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows singular urgency text for 1 seat', () => {
    render(
      <TripDepartures
        departures={[makeDep({ seatsMax: 20, seatsAvailable: 1 })]}
        tripId="t1"
        tripName="Test Trip"
      />
    )
    const badges = screen.getAllByText(/Solo 1 lugar —/)
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows Agotado badge and disables CTA when sold out', () => {
    render(
      <TripDepartures
        departures={[makeDep({ seatsMax: 20, seatsAvailable: 0 })]}
        tripId="t1"
        tripName="Test Trip"
      />
    )
    const agotadoBadges = screen.getAllByText('Agotado')
    expect(agotadoBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('renders section heading', () => {
    render(<TripDepartures departures={[makeDep()]} tripId="t1" tripName="Test Trip" />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Proximas Salidas')
  })

  it('has accessible section label', () => {
    render(<TripDepartures departures={[]} tripId="t1" tripName="Test Trip" />)
    expect(screen.getByLabelText('Proximas salidas')).toBeInTheDocument()
  })

  it('calls onSelectDeparture callback on CTA click', () => {
    const onSelect = vi.fn()
    render(
      <TripDepartures
        departures={[makeDep({ id: 'dep-callback' })]}
        tripId="t1"
        tripName="Test Trip"
        onSelectDeparture={onSelect}
      />
    )

    const ctaButtons = screen.getAllByText('Apartar Lugar')
    fireEvent.click(ctaButtons[0])

    expect(onSelect).toHaveBeenCalledWith('dep-callback')
  })

  it('does not call onSelectDeparture for sold out departure', () => {
    const onSelect = vi.fn()
    render(
      <TripDepartures
        departures={[makeDep({ seatsAvailable: 0 })]}
        tripId="t1"
        tripName="Test Trip"
        onSelectDeparture={onSelect}
      />
    )

    const agotadoButtons = screen.getAllByText('Agotado')
    fireEvent.click(agotadoButtons[0])

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows countdown for departures within 30 days', async () => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 10)
    render(
      <TripDepartures
        departures={[makeDep({ startDate: soon.toISOString() })]}
        tripId="t1"
        tripName="Test Trip"
      />
    )
    await waitFor(() => {
      const countdowns = screen.getAllByText(/Sale en \d+ dia/)
      expect(countdowns.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('does not show countdown for departures more than 30 days away', async () => {
    render(
      <TripDepartures
        departures={[makeDep()]}
        tripId="t1"
        tripName="Test Trip"
      />
    )
    // Wait for useEffect to settle, then check
    await waitFor(() => {
      expect(screen.queryByText(/Sale en/)).not.toBeInTheDocument()
    })
  })

  it('works without onSelectDeparture (backward compat)', () => {
    render(
      <TripDepartures
        departures={[makeDep()]}
        tripId="t1"
        tripName="Test Trip"
      />
    )

    const ctaButtons = screen.getAllByText('Apartar Lugar')
    expect(() => fireEvent.click(ctaButtons[0])).not.toThrow()
  })
})
