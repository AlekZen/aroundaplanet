import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { RoleBadge } from './RoleBadge'
import type { UserRole } from '@/types/user'
import { ROLE_COLORS } from '@/config/roles'

afterEach(() => {
  cleanup()
})

const ROLE_EXPECTED_LABELS: Record<UserRole, string> = {
  superadmin: 'SuperAdmin',
  director: 'Director',
  admin: 'Admin',
  agente: 'Agente',
  cliente: 'Cliente',
}

describe('RoleBadge', () => {
  const ALL_ROLES: UserRole[] = ['superadmin', 'director', 'admin', 'agente', 'cliente']

  it.each(ALL_ROLES)('renders badge with correct text for role "%s"', (role) => {
    render(<RoleBadge role={role} />)
    expect(screen.getByText(ROLE_EXPECTED_LABELS[role])).toBeInTheDocument()
  })

  it.each(ALL_ROLES)('applies correct color classes for role "%s"', (role) => {
    render(<RoleBadge role={role} />)
    const badge = screen.getByLabelText(ROLE_EXPECTED_LABELS[role])
    const colors = ROLE_COLORS[role]
    expect(badge).toHaveClass(colors.bg)
    expect(badge).toHaveClass(colors.text)
  })

  it.each(ALL_ROLES)('has correct aria-label for role "%s"', (role) => {
    render(<RoleBadge role={role} />)
    expect(screen.getByLabelText(ROLE_EXPECTED_LABELS[role])).toBeInTheDocument()
  })
})
