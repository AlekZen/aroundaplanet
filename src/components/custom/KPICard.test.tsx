import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { KPICard } from './KPICard'

// KPICard es Server Component (sin 'use client') — no requiere mocks de framer-motion ni navigation

afterEach(() => {
  cleanup()
})

describe('KPICard', () => {
  it('renders title and value', () => {
    render(<KPICard title="Ventas" value="$100,000" />)
    expect(screen.getByText('Ventas')).toBeInTheDocument()
    expect(screen.getByText('$100,000')).toBeInTheDocument()
  })

  it('shows skeleton when loading', () => {
    const { container } = render(<KPICard title="Test" value={0} isLoading />)
    expect(container.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]').length).toBeGreaterThan(0)
  })

  it('has aria-label', () => {
    render(<KPICard title="Revenue" value="$50K" />)
    expect(screen.getByLabelText('Revenue: $50K')).toBeInTheDocument()
  })

  it('applies custom className to the card', () => {
    render(<KPICard title="Test" value="99" className="custom-kpi" />)
    expect(screen.getByLabelText('Test: 99').closest('[class*="custom-kpi"]') ?? screen.getByLabelText('Test: 99')).toBeTruthy()
    // Verificar que el className llega al elemento raiz
    const card = screen.getByLabelText('Test: 99')
    expect(card).toHaveClass('custom-kpi')
  })

  it('renders TrendingUp icon when trend direction is "up"', () => {
    const { container } = render(<KPICard title="KPI" value="100" trend={{ direction: 'up', percentage: 15 }} />)
    // El porcentaje debe aparecer en el DOM
    expect(screen.getByText('15%')).toBeInTheDocument()
    // El contenedor del trend tiene clase de color verde
    const trendContainer = container.querySelector('.text-green-600')
    expect(trendContainer).toBeInTheDocument()
  })

  it('renders TrendingDown icon when trend direction is "down"', () => {
    const { container } = render(<KPICard title="KPI" value="100" trend={{ direction: 'down', percentage: 8 }} />)
    expect(screen.getByText('8%')).toBeInTheDocument()
    // El contenedor del trend tiene clase destructive
    const trendContainer = container.querySelector('.text-destructive')
    expect(trendContainer).toBeInTheDocument()
  })

  it('renders Minus icon when trend direction is "flat"', () => {
    const { container } = render(<KPICard title="KPI" value="100" trend={{ direction: 'flat', percentage: 0 }} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
    // El contenedor del trend tiene clase muted para flat
    const trendContainer = container.querySelector('.text-muted-foreground')
    expect(trendContainer).toBeInTheDocument()
  })

  it('does NOT render trend section when trend prop is absent', () => {
    const { container } = render(<KPICard title="KPI" value="100" />)
    // No debe haber contenedor con clase de color de trend (green-600, destructive, muted-foreground con flex items-center)
    // Verificamos que no hay div con las clases tipicas del bloque trend
    const trendContainers = container.querySelectorAll('.flex.items-center.gap-1.text-xs.mt-1')
    expect(trendContainers.length).toBe(0)
  })

  it('variant="compact" applies text-2xl to value', () => {
    const { container } = render(<KPICard title="KPI" value="42" variant="compact" />)
    const valueEl = container.querySelector('.text-2xl')
    expect(valueEl).toBeInTheDocument()
    expect(valueEl?.textContent).toBe('42')
  })

  it('variant="expanded" applies text-3xl to value', () => {
    const { container } = render(<KPICard title="KPI" value="42" variant="expanded" />)
    const valueEl = container.querySelector('.text-3xl')
    expect(valueEl).toBeInTheDocument()
    expect(valueEl?.textContent).toBe('42')
  })

  it('loading state renders Skeleton components without title/value text', () => {
    const { queryByText } = render(<KPICard title="VentasLoading" value="999999" isLoading />)
    // En estado de carga no debe aparecer el titulo ni el valor
    expect(queryByText('VentasLoading')).not.toBeInTheDocument()
    expect(queryByText('999999')).not.toBeInTheDocument()
  })
})
