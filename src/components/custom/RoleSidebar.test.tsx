import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { RoleSidebar } from './RoleSidebar'

// Mock configurable de usePathname
const mockUsePathname = vi.fn(() => '/admin/verification')

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))
vi.mock('framer-motion', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: (v: any) => v }))
vi.mock('@/components/ui/sidebar', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Sidebar: ({ children, className }: any) => <nav aria-label="Sidebar de navegacion" className={className}>{children}</nav>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarContent: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarGroup: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarGroupContent: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarMenu: ({ children }: any) => <ul>{children}</ul>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarMenuItem: ({ children }: any) => <li>{children}</li>,
  // El mock expone isActive como data-active para poder verificarlo en tests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarMenuButton: ({ children, isActive }: any) => (
    <div data-active={isActive ? 'true' : 'false'}>{children}</div>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarFooter: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

afterEach(() => {
  cleanup()
})

describe('RoleSidebar', () => {
  it('renders navigation for admin role', () => {
    mockUsePathname.mockReturnValue('/admin/verification')
    render(<RoleSidebar roles={['admin']} />)
    expect(screen.getByRole('navigation', { name: /sidebar/i })).toBeInTheDocument()
    expect(screen.getByText('Panel')).toBeInTheDocument()
    expect(screen.getByText('Leads')).toBeInTheDocument()
    expect(screen.getByText('Verificacion')).toBeInTheDocument()
    expect(screen.getByText('Viajes')).toBeInTheDocument()
    expect(screen.getByText('Sync Odoo')).toBeInTheDocument()
    expect(screen.getByText('Mis Viajes')).toBeInTheDocument()
    expect(screen.getByText('Mi Perfil')).toBeInTheDocument()
  })

  it('does not show phantom items for admin', () => {
    mockUsePathname.mockReturnValue('/admin/verification')
    render(<RoleSidebar roles={['admin']} />)
    expect(screen.queryByText('Agentes')).not.toBeInTheDocument()
    expect(screen.queryByText('Clientes')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    mockUsePathname.mockReturnValue('/admin/verification')
    render(<RoleSidebar roles={['admin']} className="test-class" />)
    expect(screen.getByRole('navigation', { name: /sidebar/i })).toHaveClass('test-class')
  })

  it('active section has data-active="true" when pathname matches exactly', () => {
    mockUsePathname.mockReturnValue('/admin/verification')
    render(<RoleSidebar roles={['admin']} />)
    const buttons = document.querySelectorAll('[data-active]')
    const activeButton = Array.from(buttons).find((b) => b.getAttribute('data-active') === 'true')
    expect(activeButton).toBeTruthy()
    expect(activeButton?.textContent).toContain('Verificacion')
  })

  it('active section has data-active="true" when pathname starts with href + /', () => {
    mockUsePathname.mockReturnValue('/admin/verification/detail')
    render(<RoleSidebar roles={['admin']} />)
    const buttons = document.querySelectorAll('[data-active]')
    const activeButton = Array.from(buttons).find((b) => b.getAttribute('data-active') === 'true')
    expect(activeButton).toBeTruthy()
    expect(activeButton?.textContent).toContain('Verificacion')
  })

  it('inactive sections have data-active="false"', () => {
    mockUsePathname.mockReturnValue('/admin/verification')
    render(<RoleSidebar roles={['admin']} />)
    const buttons = document.querySelectorAll('[data-active="false"]')
    // Admin tiene 7 items, 1 activo = 6 inactivos
    expect(buttons.length).toBe(6)
  })

  it('renders combined sections for multiple roles', () => {
    mockUsePathname.mockReturnValue('/director/dashboard')
    render(<RoleSidebar roles={['admin', 'director']} />)
    // Items de admin
    expect(screen.getByText('Verificacion')).toBeInTheDocument()
    // Items de director
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    // Ambos tienen Viajes y Sync Odoo (duplicado por multi-role)
  })

  it('renders director sections correctly', () => {
    mockUsePathname.mockReturnValue('/director/dashboard')
    render(<RoleSidebar roles={['director']} />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Viajes')).toBeInTheDocument()
    expect(screen.getByText('Sync Odoo')).toBeInTheDocument()
    expect(screen.getByText('Mis Viajes')).toBeInTheDocument()
    expect(screen.getByText('Mi Perfil')).toBeInTheDocument()
    // No debe tener items exclusivos de admin
    expect(screen.queryByText('Verificacion')).not.toBeInTheDocument()
  })

  it('renders agente sections correctly (3 items)', () => {
    mockUsePathname.mockReturnValue('/agent/dashboard')
    render(<RoleSidebar roles={['agente']} />)
    expect(screen.getByText('Mi Negocio')).toBeInTheDocument()
    expect(screen.getByText('Mis Viajes')).toBeInTheDocument()
    expect(screen.getByText('Mi Perfil')).toBeInTheDocument()
    // No debe tener items fantasma
    expect(screen.queryByText('Clientes')).not.toBeInTheDocument()
    expect(screen.queryByText('Pagos')).not.toBeInTheDocument()
  })

  it('renders superadmin sections correctly with Verificacion', () => {
    mockUsePathname.mockReturnValue('/superadmin/users')
    render(<RoleSidebar roles={['superadmin']} />)
    expect(screen.getByText('Usuarios')).toBeInTheDocument()
    expect(screen.getByText('Leads')).toBeInTheDocument()
    expect(screen.getByText('Verificacion')).toBeInTheDocument()
    expect(screen.getByText('Viajes')).toBeInTheDocument()
    expect(screen.getByText('Sync Odoo')).toBeInTheDocument()
    expect(screen.getByText('Mis Viajes')).toBeInTheDocument()
    expect(screen.getByText('Mi Perfil')).toBeInTheDocument()
    // No debe tener Configuracion fantasma
    expect(screen.queryByText('Configuracion')).not.toBeInTheDocument()
  })
})
