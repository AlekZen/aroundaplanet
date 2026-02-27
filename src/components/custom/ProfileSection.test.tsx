import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ProfileSection } from './ProfileSection'

afterEach(() => {
  cleanup()
})

describe('ProfileSection', () => {
  it('renders title text', () => {
    render(
      <ProfileSection title="Informacion Personal">
        <p>Contenido de prueba</p>
      </ProfileSection>
    )
    expect(screen.getByText('Informacion Personal')).toBeInTheDocument()
  })

  it('renders children when defaultOpen is true', () => {
    render(
      <ProfileSection title="Seccion Abierta" defaultOpen>
        <p>Contenido visible</p>
      </ProfileSection>
    )
    expect(screen.getByText('Contenido visible')).toBeVisible()
  })

  it('hides content when defaultOpen is false (initial state)', () => {
    render(
      <ProfileSection title="Seccion Cerrada">
        <p>Contenido oculto</p>
      </ProfileSection>
    )
    // Radix Collapsible.Content renderiza un div hidden="" vacio cuando cerrado —
    // el children no se monta en el DOM, por lo que queryByText retorna null
    expect(screen.queryByText('Contenido oculto')).toBeNull()
  })

  it('toggles content visibility when header is clicked', () => {
    render(
      <ProfileSection title="Seccion Toggle">
        <p>Contenido toggle</p>
      </ProfileSection>
    )

    const header = screen.getByRole('button', { name: /Seccion Toggle/i })

    // Estado inicial: cerrado — children no esta en el DOM
    expect(screen.queryByText('Contenido toggle')).toBeNull()

    // Click para abrir — children aparece en el DOM
    fireEvent.click(header)
    expect(screen.getByText('Contenido toggle')).toBeInTheDocument()

    // Click para cerrar de nuevo — children desaparece del DOM
    fireEvent.click(header)
    expect(screen.queryByText('Contenido toggle')).toBeNull()
  })

  it('renders icon when provided', () => {
    render(
      <ProfileSection title="Con Icono" icon={<svg data-testid="test-icon" />}>
        <p>Contenido</p>
      </ProfileSection>
    )
    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
  })

  it('renders badge when provided', () => {
    render(
      <ProfileSection title="Con Badge" badge={<span data-testid="test-badge">Nuevo</span>}>
        <p>Contenido</p>
      </ProfileSection>
    )
    expect(screen.getByTestId('test-badge')).toBeInTheDocument()
    expect(screen.getByText('Nuevo')).toBeInTheDocument()
  })

  it('has correct aria-expanded attribute when closed', () => {
    render(
      <ProfileSection title="ARIA Cerrado">
        <p>Contenido</p>
      </ProfileSection>
    )
    const header = screen.getByRole('button', { name: /ARIA Cerrado/i })
    expect(header).toHaveAttribute('aria-expanded', 'false')
  })

  it('has correct aria-expanded attribute when open', () => {
    render(
      <ProfileSection title="ARIA Abierto" defaultOpen>
        <p>Contenido</p>
      </ProfileSection>
    )
    const header = screen.getByRole('button', { name: /ARIA Abierto/i })
    expect(header).toHaveAttribute('aria-expanded', 'true')
  })

  it('updates aria-expanded when toggled', () => {
    render(
      <ProfileSection title="ARIA Toggle">
        <p>Contenido</p>
      </ProfileSection>
    )
    const header = screen.getByRole('button', { name: /ARIA Toggle/i })

    expect(header).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
  })

  it('ChevronDown has rotate-180 class when open', () => {
    const { container } = render(
      <ProfileSection title="Chevron Abierto" defaultOpen>
        <p>Contenido</p>
      </ProfileSection>
    )
    // El icono ChevronDown recibe rotate-180 cuando isOpen es true
    const chevron = container.querySelector('.rotate-180')
    expect(chevron).not.toBeNull()
  })

  it('ChevronDown does not have rotate-180 class when closed', () => {
    const { container } = render(
      <ProfileSection title="Chevron Cerrado">
        <p>Contenido</p>
      </ProfileSection>
    )
    const chevron = container.querySelector('.rotate-180')
    expect(chevron).toBeNull()
  })

  it('ChevronDown rotates when header is clicked (closed to open)', () => {
    const { container } = render(
      <ProfileSection title="Chevron Toggle">
        <p>Contenido</p>
      </ProfileSection>
    )

    // Cerrado: sin rotate-180
    expect(container.querySelector('.rotate-180')).toBeNull()

    const header = screen.getByRole('button', { name: /Chevron Toggle/i })
    fireEvent.click(header)

    // Abierto: con rotate-180
    expect(container.querySelector('.rotate-180')).not.toBeNull()
  })
})
