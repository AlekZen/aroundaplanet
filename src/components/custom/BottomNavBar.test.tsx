import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { BottomNavBar } from './BottomNavBar'

// Mock configurable para usePathname — se sobreescribe por test donde sea necesario
const mockUsePathname = vi.fn(() => '/dashboard')

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))
vi.mock('framer-motion', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  motion: { div: (props: any) => <div {...props} /> },
  useReducedMotion: () => false,
}))

afterEach(() => {
  cleanup()
})

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: <span>D</span>, href: '/dashboard' },
  { id: 'clients', label: 'Clientes', icon: <span>C</span>, href: '/clients' },
  { id: 'payments', label: 'Pagos', icon: <span>P</span>, href: '/payments' },
]

describe('BottomNavBar', () => {
  it('renders navigation with tabs', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<BottomNavBar tabs={tabs} />)
    expect(screen.getByRole('navigation', { name: /navegacion principal/i })).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Clientes')).toBeInTheDocument()
    expect(screen.getByText('Pagos')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    const { container } = render(<BottomNavBar tabs={tabs} className="test-class" />)
    expect(container.querySelector('nav')).toHaveClass('test-class')
  })

  it('aria-current="page" on the active tab when pathname matches', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<BottomNavBar tabs={tabs} />)
    const links = screen.getAllByRole('link')
    const dashboardLink = links.find((l) => l.textContent?.includes('Dashboard'))
    expect(dashboardLink).toHaveAttribute('aria-current', 'page')
  })

  it('aria-current="page" on the active tab when pathname starts with href + /', () => {
    mockUsePathname.mockReturnValue('/dashboard/overview')
    render(<BottomNavBar tabs={tabs} />)
    const links = screen.getAllByRole('link')
    const dashboardLink = links.find((l) => l.textContent?.includes('Dashboard'))
    expect(dashboardLink).toHaveAttribute('aria-current', 'page')
  })

  it('aria-current is NOT present on inactive tabs', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<BottomNavBar tabs={tabs} />)
    const links = screen.getAllByRole('link')
    const clientesLink = links.find((l) => l.textContent?.includes('Clientes'))
    const pagosLink = links.find((l) => l.textContent?.includes('Pagos'))
    expect(clientesLink).not.toHaveAttribute('aria-current')
    expect(pagosLink).not.toHaveAttribute('aria-current')
  })

  it('renders badge count when notificationBadges is provided', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<BottomNavBar tabs={tabs} notificationBadges={{ clients: 3 }} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('does NOT render badge span when count is 0', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    const { container } = render(<BottomNavBar tabs={tabs} notificationBadges={{ dashboard: 0 }} />)
    // Badge con valor 0 no debe tener el span circular (bg-destructive) — el componente hace badge > 0
    const badgeSpans = container.querySelectorAll('span.rounded-full.bg-destructive')
    expect(badgeSpans.length).toBe(0)
  })

  it('renders badge for multiple tabs simultaneously', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<BottomNavBar tabs={tabs} notificationBadges={{ clients: 5, payments: 2 }} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
