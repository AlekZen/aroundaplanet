import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { UserTable } from './UserTable'

function mockUsersResponse(users: Array<Record<string, unknown>> = [], total?: number) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      users,
      nextCursor: null,
      total: total ?? users.length,
    }),
  })
}

describe('UserTable', () => {
  const onEditRoles = vi.fn()
  const onDeactivate = vi.fn()

  beforeEach(() => {
    onEditRoles.mockReset()
    onDeactivate.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows skeleton loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<UserTable onEditRoles={onEditRoles} onDeactivate={onDeactivate} />)
    expect(screen.getByRole('status', { name: /cargando/i })).toBeInTheDocument()
  })

  it('renders user list after fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockUsersResponse([
      { uid: 'u1', displayName: 'Alice', email: 'alice@test.com', isActive: true, roles: ['cliente', 'admin'] },
      { uid: 'u2', displayName: 'Bob', email: 'bob@test.com', isActive: false, roles: ['cliente'] },
    ])))

    render(<UserTable onEditRoles={onEditRoles} onDeactivate={onDeactivate} />)

    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
    }, { timeout: 2000 })
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0)
    expect(screen.getByText('2 usuarios')).toBeInTheDocument()
  })

  it('shows empty state when no users', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockUsersResponse([])))
    render(<UserTable onEditRoles={onEditRoles} onDeactivate={onDeactivate} />)

    await waitFor(() => {
      expect(screen.getByText(/no se encontraron/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('shows error state on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ message: 'Server error' }),
    })))

    render(<UserTable onEditRoles={onEditRoles} onDeactivate={onDeactivate} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    }, { timeout: 2000 })
    expect(screen.getByText('Server error')).toBeInTheDocument()
  })

  it('renders search input and filter dropdowns', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockUsersResponse([])))
    render(<UserTable onEditRoles={onEditRoles} onDeactivate={onDeactivate} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/buscar/i)).toBeInTheDocument()
    }, { timeout: 2000 })
    expect(screen.getByLabelText(/filtrar por rol/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/filtrar por estado/i)).toBeInTheDocument()
  })

  it('renders role badges for users', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockUsersResponse([
      { uid: 'u1', displayName: 'Alice', email: 'a@t.com', isActive: true, roles: ['cliente', 'admin'] },
    ])))

    render(<UserTable onEditRoles={onEditRoles} onDeactivate={onDeactivate} />)

    await waitFor(() => {
      expect(screen.getAllByText('Admin').length).toBeGreaterThan(0)
    }, { timeout: 2000 })
    expect(screen.getAllByText('Cliente').length).toBeGreaterThan(0)
  })

  it('renders action buttons for each user', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockUsersResponse([
      { uid: 'u1', displayName: 'Alice', email: 'a@t.com', isActive: true, roles: ['cliente'] },
    ])))

    render(<UserTable onEditRoles={onEditRoles} onDeactivate={onDeactivate} />)

    await waitFor(() => {
      expect(screen.getAllByText('Editar Roles').length).toBeGreaterThan(0)
    }, { timeout: 2000 })
    expect(screen.getAllByText('Desactivar').length).toBeGreaterThan(0)
  })
})
