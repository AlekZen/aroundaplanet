import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { TripCard } from './TripCard'

vi.mock('framer-motion', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
  useReducedMotion: () => false,
}))

afterEach(() => {
  cleanup()
})

const trip = {
  title: 'Vuelta al Mundo',
  slug: 'vuelta-al-mundo',
  imageUrl: '/test.jpg',
  price: 14500000,
  dates: 'Mar 2026',
  destination: 'Global',
}

describe('TripCard', () => {
  it('renders trip title and destination', () => {
    render(<TripCard trip={trip} />)
    expect(screen.getByText('Vuelta al Mundo')).toBeInTheDocument()
    expect(screen.getByText('Global')).toBeInTheDocument()
  })

  it('has article role with aria-label', () => {
    render(<TripCard trip={trip} />)
    expect(screen.getByRole('article', { name: 'Vuelta al Mundo' })).toBeInTheDocument()
  })

  it('applies custom className to the card', () => {
    render(<TripCard trip={trip} className="custom-trip" />)
    const article = screen.getByRole('article', { name: 'Vuelta al Mundo' })
    expect(article).toHaveClass('custom-trip')
  })

  it('onClick fires when card is clicked', () => {
    const handleClick = vi.fn()
    render(<TripCard trip={trip} onClick={handleClick} />)
    const article = screen.getByRole('article', { name: 'Vuelta al Mundo' })
    fireEvent.click(article)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('onClick fires when CTA button is clicked', () => {
    const handleClick = vi.fn()
    render(<TripCard trip={trip} onClick={handleClick} />)
    const button = screen.getByRole('button', { name: /cotizar/i })
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('variant="public" renders "Cotizar" CTA', () => {
    render(<TripCard trip={trip} variant="public" />)
    expect(screen.getByRole('button', { name: /cotizar/i })).toBeInTheDocument()
  })

  it('variant="agent" renders "Copiar Link" CTA', () => {
    render(<TripCard trip={trip} variant="agent" />)
    expect(screen.getByRole('button', { name: /copiar link/i })).toBeInTheDocument()
  })

  it('variant="client" renders "Ver Progreso" CTA', () => {
    render(<TripCard trip={trip} variant="client" />)
    expect(screen.getByRole('button', { name: /ver progreso/i })).toBeInTheDocument()
  })

  it('variant="compact" renders "Ver" CTA', () => {
    render(<TripCard trip={trip} variant="compact" />)
    expect(screen.getByRole('button', { name: /^ver$/i })).toBeInTheDocument()
  })

  it('price is formatted correctly using formatCurrency (centavos -> MXN)', () => {
    // 14500000 centavos = $145,000 MXN
    render(<TripCard trip={trip} />)
    // formatCurrency usa Intl.NumberFormat es-MX — el formato puede variar por entorno
    // Verificamos que el valor en pesos aparece (14500000 / 100 = 145000)
    expect(screen.getByText(/145,000|145\.000/)).toBeInTheDocument()
  })

  it('renders trip dates', () => {
    render(<TripCard trip={trip} />)
    expect(screen.getByText('Mar 2026')).toBeInTheDocument()
  })
})
