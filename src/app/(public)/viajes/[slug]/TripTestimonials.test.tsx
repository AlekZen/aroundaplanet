import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TripTestimonials } from './TripTestimonials'

describe('TripTestimonials', () => {
  it('renders empty state when no testimonials', () => {
    render(<TripTestimonials testimonials={[]} />)
    expect(
      screen.getByText('Se el primero en compartir tu experiencia')
    ).toBeInTheDocument()
  })

  it('renders CTA in empty state', () => {
    render(<TripTestimonials testimonials={[]} />)
    expect(screen.getByText('Unirse a la Aventura')).toBeInTheDocument()
  })

  it('never shows "No hay datos" or "Sin testimonios"', () => {
    render(<TripTestimonials testimonials={[]} />)
    expect(screen.queryByText('No hay datos')).not.toBeInTheDocument()
    expect(screen.queryByText('Sin testimonios')).not.toBeInTheDocument()
  })

  it('renders testimonial cards when testimonials exist', () => {
    render(
      <TripTestimonials
        testimonials={[
          { id: 't1', name: 'Maria', text: 'Increible viaje', rating: 5 },
          { id: 't2', name: 'Carlos', text: 'Muy recomendado', rating: 4 },
        ]}
      />
    )
    expect(screen.getByText('Maria')).toBeInTheDocument()
    expect(screen.getByText('Increible viaje')).toBeInTheDocument()
    expect(screen.getByText('Carlos')).toBeInTheDocument()
  })

  it('renders star ratings with accessible labels', () => {
    render(
      <TripTestimonials
        testimonials={[
          { id: 't1', name: 'Maria', text: 'Genial', rating: 4 },
        ]}
      />
    )
    expect(screen.getByLabelText('4 de 5 estrellas')).toBeInTheDocument()
  })

  it('renders section heading', () => {
    render(<TripTestimonials testimonials={[]} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Experiencias de Viajeros'
    )
  })

  it('has accessible section label', () => {
    render(<TripTestimonials testimonials={[]} />)
    expect(screen.getByLabelText('Testimonios de viajeros')).toBeInTheDocument()
  })
})
