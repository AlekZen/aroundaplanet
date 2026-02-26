import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { StatusBadge } from './StatusBadge'

afterEach(() => {
  cleanup()
})

describe('StatusBadge', () => {
  it('renders "Activo" with green styling when isActive is true', () => {
    render(<StatusBadge isActive={true} />)
    const badge = screen.getByText('Activo')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-green-100')
    expect(badge).toHaveClass('text-green-800')
  })

  it('renders "Inactivo" with muted styling when isActive is false', () => {
    render(<StatusBadge isActive={false} />)
    const badge = screen.getByText('Inactivo')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-gray-100')
    expect(badge).toHaveClass('text-gray-500')
  })

  it('has correct aria-label "Activo" when active', () => {
    render(<StatusBadge isActive={true} />)
    expect(screen.getByLabelText('Activo')).toBeInTheDocument()
  })

  it('has correct aria-label "Inactivo" when inactive', () => {
    render(<StatusBadge isActive={false} />)
    expect(screen.getByLabelText('Inactivo')).toBeInTheDocument()
  })
})
