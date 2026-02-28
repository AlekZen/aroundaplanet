import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TripDescription } from './TripDescription'

describe('TripDescription', () => {
  it('renders plain text description', () => {
    render(<TripDescription description="Un viaje increible por el mundo" />)
    expect(screen.getByText('Un viaje increible por el mundo')).toBeInTheDocument()
  })

  it('strips HTML tags from Odoo rich text', () => {
    render(
      <TripDescription description="<p>Viaje con <strong>guia</strong> incluido</p>" />
    )
    expect(screen.getByText('Viaje con guia incluido')).toBeInTheDocument()
    // Verify no <strong> element in DOM (tags were stripped, not rendered as HTML)
    expect(document.querySelector('strong')).toBeNull()
  })

  it('decodes HTML entities from Odoo rich text', () => {
    render(
      <TripDescription description="Precio &amp; calidad &quot;premium&quot; con 100&nbsp;plazas" />
    )
    expect(screen.getByText('Precio & calidad "premium" con 100 plazas')).toBeInTheDocument()
  })

  it('strips tags and decodes entities together', () => {
    render(
      <TripDescription description="<p>Vuelo &amp; hotel <b>incluidos</b></p>" />
    )
    expect(screen.getByText('Vuelo & hotel incluidos')).toBeInTheDocument()
  })

  it('renders section heading', () => {
    render(<TripDescription description="Descripcion de viaje" />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Sobre este viaje')
  })

  it('returns null when description is empty', () => {
    const { container } = render(<TripDescription description="" />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when description is only HTML tags', () => {
    const { container } = render(<TripDescription description="<br/><p></p>" />)
    expect(container.firstChild).toBeNull()
  })
})
