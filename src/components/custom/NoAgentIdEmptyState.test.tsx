import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NoAgentIdEmptyState } from './NoAgentIdEmptyState'

describe('NoAgentIdEmptyState', () => {
  it('renderiza CTA SuperAdmin cuando userRole es admin', () => {
    const { container } = render(<NoAgentIdEmptyState userRole="admin" />)

    expect(screen.getByText('Tu cuenta no tiene perfil de agente')).toBeDefined()
    const cta = screen.getByRole('link', { name: /SuperAdmin/i })
    expect(cta.getAttribute('href')).toBe('/superadmin/users')
    expect(container.querySelector('svg.lucide-user-plus')).not.toBeNull()
  })

  it('renderiza CTA mailto cuando userRole es agente', () => {
    render(<NoAgentIdEmptyState userRole="agente" />)

    expect(screen.getByText('Aún no tienes perfil de agente')).toBeDefined()
    const cta = screen.getByRole('link', { name: /Solicitar acceso de agente/i })
    expect(cta.getAttribute('href')).toContain('mailto:soporte@aroundaplanet.com')
  })

  it('default (sin prop userRole) es agente con CTA mailto', () => {
    render(<NoAgentIdEmptyState />)

    const cta = screen.getByRole('link', { name: /Solicitar acceso de agente/i })
    expect(cta.getAttribute('href')).toContain('mailto:')
  })

  it('override title y description renderiza valores custom', () => {
    render(
      <NoAgentIdEmptyState
        userRole="agente"
        title="Título personalizado"
        description="Descripción personalizada para el contexto."
      />,
    )

    expect(screen.getByText('Título personalizado')).toBeDefined()
    expect(screen.getByText('Descripción personalizada para el contexto.')).toBeDefined()
  })

  it('icon UserPlus visible y oculto a screen readers', () => {
    const { container } = render(<NoAgentIdEmptyState userRole="agente" />)

    const icon = container.querySelector('svg.lucide-user-plus')
    expect(icon).not.toBeNull()
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
  })
})
