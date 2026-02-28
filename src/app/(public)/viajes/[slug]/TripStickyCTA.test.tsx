import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TripStickyCTA } from './TripStickyCTA'

describe('TripStickyCTA', () => {
  it('renders desktop CTA button', () => {
    render(<TripStickyCTA />)
    expect(screen.getByText('Cotizar Ahora')).toBeInTheDocument()
  })

  it('renders mobile CTA button', () => {
    render(<TripStickyCTA />)
    expect(screen.getByText('Cotizar')).toBeInTheDocument()
  })

  it('calls onQuoteClick callback on CTA click', () => {
    const onQuoteClick = vi.fn()
    render(<TripStickyCTA onQuoteClick={onQuoteClick} />)

    fireEvent.click(screen.getByText('Cotizar Ahora'))

    expect(onQuoteClick).toHaveBeenCalledTimes(1)
  })

  it('calls onQuoteClick callback on mobile CTA click', () => {
    const onQuoteClick = vi.fn()
    render(<TripStickyCTA onQuoteClick={onQuoteClick} />)

    fireEvent.click(screen.getByText('Cotizar'))

    expect(onQuoteClick).toHaveBeenCalledTimes(1)
  })

  it('has accessible label on mobile CTA container', () => {
    render(<TripStickyCTA />)
    expect(screen.getByLabelText('Accion principal')).toBeInTheDocument()
  })

  it('works without onQuoteClick (backward compat)', () => {
    render(<TripStickyCTA />)
    expect(() => fireEvent.click(screen.getByText('Cotizar Ahora'))).not.toThrow()
  })
})
