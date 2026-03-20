import { render, screen, cleanup, within, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { RoleAssignmentSheet, type RoleAssignmentSheetProps } from './RoleAssignmentSheet'
import type { UserRole } from '@/types/user'

afterEach(() => {
  cleanup()
})

const MOCK_USER = {
  uid: 'user-123',
  displayName: 'Juan Perez',
  roles: ['cliente', 'agente'] as UserRole[],
  agentId: 'AGT-001',
}

function renderSheet(overrides: Partial<RoleAssignmentSheetProps> = {}) {
  const defaultProps: RoleAssignmentSheetProps = {
    isOpen: true,
    onOpenChange: vi.fn(),
    user: MOCK_USER,
    onSave: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  return {
    ...render(<RoleAssignmentSheet {...defaultProps} />),
    props: defaultProps,
  }
}

describe('RoleAssignmentSheet', () => {
  it('renders sheet when isOpen is true', () => {
    renderSheet()
    expect(screen.getByText('Asignar Roles')).toBeInTheDocument()
    expect(screen.getByText(/Modifica los roles de Juan Perez/)).toBeInTheDocument()
  })

  it('does not render content when isOpen is false', () => {
    renderSheet({ isOpen: false })
    expect(screen.queryByText('Asignar Roles')).not.toBeInTheDocument()
  })

  it('renders nothing when user is null', () => {
    renderSheet({ user: null })
    expect(screen.queryByText('Asignar Roles')).not.toBeInTheDocument()
  })

  it('shows all role checkboxes', () => {
    renderSheet()
    expect(screen.getByRole('checkbox', { name: 'Cliente' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Agente' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Director' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'SuperAdmin' })).toBeInTheDocument()
  })

  it('Cliente checkbox is always checked and disabled', () => {
    renderSheet()
    const clienteCheckbox = screen.getByRole('checkbox', { name: 'Cliente' })
    expect(clienteCheckbox).toBeChecked()
    expect(clienteCheckbox).toBeDisabled()
  })

  it('pre-selects roles from user prop', () => {
    renderSheet()
    // User has cliente + agente
    expect(screen.getByRole('checkbox', { name: 'Cliente' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Agente' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Admin' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Director' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'SuperAdmin' })).not.toBeChecked()
  })

  it('shows current roles as RoleBadge chips', () => {
    renderSheet()
    // The user has 'cliente' and 'agente' roles, should show badges
    const currentRolesSection = screen.getByText('Roles actuales').closest('div')!
    expect(within(currentRolesSection).getByLabelText('Cliente')).toBeInTheDocument()
    expect(within(currentRolesSection).getByLabelText('Agente')).toBeInTheDocument()
  })

  it('toggling Agente shows agentId section', () => {
    renderSheet({
      user: {
        uid: 'user-456',
        displayName: 'Maria Lopez',
        roles: ['cliente'],
      },
    })

    expect(screen.queryByText(/ID de Agente/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Agente' }))

    expect(screen.getByText(/ID de Agente/)).toBeInTheDocument()
    // Auto-fills with UID
    expect(screen.getByText('user-456')).toBeInTheDocument()
  })

  it('toggling Agente off hides agentId section', () => {
    renderSheet()

    expect(screen.getByText(/ID de Agente/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Agente' }))

    expect(screen.queryByText(/ID de Agente/)).not.toBeInTheDocument()
  })

  it('shows agentId from user prop when available', () => {
    renderSheet()
    expect(screen.getByText('AGT-001')).toBeInTheDocument()
  })

  it('calls onSave with correct roles on submit', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderSheet({ onSave })

    // Click save — user has cliente + agente, agentId = AGT-001
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    const [uid, roles, agentIdArg] = onSave.mock.calls[0]
    expect(uid).toBe('user-123')
    expect(roles).toEqual(expect.arrayContaining(['cliente', 'agente']))
    expect(roles).toHaveLength(2)
    expect(agentIdArg).toBe('AGT-001')
  })

  it('calls onSave without agentId when Agente is not selected', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderSheet({
      onSave,
      user: {
        uid: 'user-789',
        displayName: 'Carlos Ruiz',
        roles: ['cliente', 'admin'],
      },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    const [uid, roles, agentIdArg] = onSave.mock.calls[0]
    expect(uid).toBe('user-789')
    expect(roles).toEqual(expect.arrayContaining(['cliente', 'admin']))
    expect(agentIdArg).toBeUndefined()
  })

  it('shows loading state during save', async () => {
    // Create a save that we control
    let resolveSave: () => void = () => {}
    const onSave = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveSave = resolve })
    )
    renderSheet({ onSave })

    const saveButton = screen.getByRole('button', { name: 'Guardar' })
    expect(saveButton).toBeEnabled()

    // Click save (don't await the full resolution — we want to catch mid-save)
    act(() => {
      fireEvent.click(saveButton)
    })

    // Should show loading text
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardando...' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled()

    // Resolve the save
    await act(async () => {
      resolveSave()
    })

    // Wait for the state to update
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
    })
  })

  it('auto-fills agentId with UID when Agente toggled on', () => {
    renderSheet({
      user: {
        uid: 'user-456',
        displayName: 'Maria Lopez',
        roles: ['cliente'],
      },
    })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Agente' }))

    // Save should be enabled because agentId auto-filled with UID
    const saveButton = screen.getByRole('button', { name: 'Guardar' })
    expect(saveButton).not.toBeDisabled()
  })

  it('calls onOpenChange when Cancelar is clicked', () => {
    const onOpenChange = vi.fn()
    renderSheet({ onOpenChange })

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('can toggle multiple roles', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderSheet({
      onSave,
      user: {
        uid: 'user-multi',
        displayName: 'Test Multi',
        roles: ['cliente'],
      },
    })

    // Add Admin and Director
    fireEvent.click(screen.getByRole('checkbox', { name: 'Admin' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Director' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    })

    const [, roles] = onSave.mock.calls[0]
    expect(roles).toEqual(expect.arrayContaining(['cliente', 'admin', 'director']))
    expect(roles).toHaveLength(3)
  })
})
