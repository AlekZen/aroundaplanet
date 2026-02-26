import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { UserDeactivateDialog } from './UserDeactivateDialog'

const activeUser = { uid: 'user-1', displayName: 'Lupita Martinez', isActive: true }
const inactiveUser = { uid: 'user-2', displayName: 'Carlos Ruiz', isActive: false }

describe('UserDeactivateDialog', () => {
  it('renders deactivation dialog for active user', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <UserDeactivateDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        user={activeUser}
        onConfirm={onConfirm}
      />
    )
    expect(screen.getByText('Desactivar usuario')).toBeInTheDocument()
    expect(screen.getByText(/Desactivar a Lupita Martinez/)).toBeInTheDocument()
    expect(screen.getByText(/no podra acceder a la plataforma/)).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo (opcional)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /desactivar/i })).toBeInTheDocument()
  })

  it('renders reactivation dialog for inactive user', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <UserDeactivateDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        user={inactiveUser}
        onConfirm={onConfirm}
      />
    )
    expect(screen.getByText('Reactivar usuario')).toBeInTheDocument()
    expect(screen.getByText(/Reactivar a Carlos Ruiz/)).toBeInTheDocument()
    expect(screen.getByText(/podra volver a acceder/)).toBeInTheDocument()
    // No debe haber textarea de motivo para reactivacion
    expect(screen.queryByLabelText('Motivo (opcional)')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reactivar/i })).toBeInTheDocument()
  })

  it('calls onConfirm with toggled isActive on confirm (deactivation)', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()
    render(
      <UserDeactivateDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        user={activeUser}
        onConfirm={onConfirm}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^desactivar$/i }))
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('user-1', false, undefined)
    })
  })

  it('calls onConfirm with toggled isActive on confirm (reactivation)', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()
    render(
      <UserDeactivateDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        user={inactiveUser}
        onConfirm={onConfirm}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^reactivar$/i }))
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('user-2', true, undefined)
    })
  })

  it('captures reason text when deactivating', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <UserDeactivateDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        user={activeUser}
        onConfirm={onConfirm}
      />
    )
    const textarea = screen.getByLabelText('Motivo (opcional)')
    fireEvent.change(textarea, { target: { value: 'Agente inactivo por 6 meses' } })
    fireEvent.click(screen.getByRole('button', { name: /^desactivar$/i }))
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('user-1', false, 'Agente inactivo por 6 meses')
    })
  })

  it('cancel button closes dialog via onOpenChange', () => {
    const onOpenChange = vi.fn()
    render(
      <UserDeactivateDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        user={activeUser}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows loading state on confirm button during async operation', async () => {
    let resolveConfirm: () => void
    const onConfirm = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveConfirm = resolve
    }))
    render(
      <UserDeactivateDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        user={activeUser}
        onConfirm={onConfirm}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^desactivar$/i }))
    // During async operation, button should show loading text and be disabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /desactivando/i })).toBeDisabled()
    })
    // Resolve the promise
    resolveConfirm!()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /desactivando/i })).not.toBeInTheDocument()
    })
  })

  it('returns null when user is null', () => {
    const { container } = render(
      <UserDeactivateDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        user={null}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('does not render when isOpen is false', () => {
    render(
      <UserDeactivateDialog
        isOpen={false}
        onOpenChange={vi.fn()}
        user={activeUser}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />
    )
    expect(screen.queryByText('Desactivar usuario')).not.toBeInTheDocument()
  })
})
