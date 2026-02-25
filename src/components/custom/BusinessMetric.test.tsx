import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BusinessMetric } from './BusinessMetric'

describe('BusinessMetric', () => {
  it('renders label and value', () => {
    render(<BusinessMetric label="Comisiones" value="$12,500" />)
    expect(screen.getByText('Comisiones')).toBeInTheDocument()
    expect(screen.getByText('$12,500')).toBeInTheDocument()
  })

  it('has aria-label', () => {
    render(<BusinessMetric label="Total" value="100" />)
    expect(screen.getByLabelText('Total: 100')).toBeInTheDocument()
  })

  it('applies custom className to the card', () => {
    render(<BusinessMetric label="Test" value="50" className="custom-metric" />)
    const card = screen.getByLabelText('Test: 50')
    expect(card).toHaveClass('custom-metric')
  })

  it('renders TrendingUp icon and green color when comparison direction is "up"', () => {
    const { container } = render(
      <BusinessMetric
        label="Ventas"
        value="$100,000"
        comparison={{ label: 'vs mes anterior', value: '+12%', direction: 'up' }}
      />
    )
    // El texto de comparison debe estar en el DOM
    expect(screen.getByText('+12% vs mes anterior')).toBeInTheDocument()
    // El contenedor de comparison tiene clase verde
    const comparisonEl = container.querySelector('.text-green-600')
    expect(comparisonEl).toBeInTheDocument()
  })

  it('renders TrendingDown icon and destructive color when comparison direction is "down"', () => {
    const { container } = render(
      <BusinessMetric
        label="Ventas"
        value="$80,000"
        comparison={{ label: 'vs mes anterior', value: '-5%', direction: 'down' }}
      />
    )
    expect(screen.getByText('-5% vs mes anterior')).toBeInTheDocument()
    const comparisonEl = container.querySelector('.text-destructive')
    expect(comparisonEl).toBeInTheDocument()
  })

  it('does NOT render comparison section when comparison prop is absent', () => {
    render(<BusinessMetric label="KPI" value="10" />)
    // No debe haber clases de color de trend
    const { container } = render(<BusinessMetric label="KPI2" value="20" />)
    expect(container.querySelector('.text-green-600')).not.toBeInTheDocument()
    expect(container.querySelector('.text-destructive')).not.toBeInTheDocument()
  })

  it('variant="highlight" applies accent styles to the card', () => {
    const { container } = render(
      <BusinessMetric label="Destacado" value="99" variant="highlight" />
    )
    // El Card debe tener las clases de acento
    const card = container.querySelector('[class*="bg-accent-muted"]')
    expect(card).toBeInTheDocument()
  })

  it('variant="default" does NOT apply accent styles', () => {
    const { container } = render(
      <BusinessMetric label="Normal" value="10" variant="default" />
    )
    const card = container.querySelector('[class*="bg-accent-muted"]')
    expect(card).not.toBeInTheDocument()
  })
})
