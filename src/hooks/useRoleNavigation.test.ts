import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/useAuthStore'
import { useRoleNavigation } from './useRoleNavigation'
import { renderHook } from '@testing-library/react'

describe('useRoleNavigation', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      profile: null,
      claims: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    })
  })

  it('returns empty array for unauthenticated user', () => {
    const { result } = renderHook(() => useRoleNavigation())
    expect(result.current).toEqual([])
  })

  it('returns empty array when claims is null', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      claims: null,
    })

    const { result } = renderHook(() => useRoleNavigation())
    expect(result.current).toEqual([])
  })

  it('returns exactly 2 items for cliente-only user', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      claims: { roles: ['cliente'] },
    })

    const { result } = renderHook(() => useRoleNavigation())
    expect(result.current).toHaveLength(2)
    expect(result.current[0]).toEqual({
      role: 'cliente',
      label: 'Mis Viajes',
      href: '/client/my-trips',
      priority: 1,
    })
    expect(result.current[1].label).toBe('Perfil')
  })

  it('returns exactly 3 items for agente-only user', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      claims: { roles: ['agente'] },
    })

    const { result } = renderHook(() => useRoleNavigation())
    expect(result.current).toHaveLength(3)
    expect(result.current[0].label).toBe('Mi Portal')
    expect(result.current[1].label).toBe('Mis Clientes')
    expect(result.current[2].label).toBe('Perfil')
  })

  it('returns exactly 1 item for admin-only user', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      claims: { roles: ['admin'] },
    })

    const { result } = renderHook(() => useRoleNavigation())
    expect(result.current).toHaveLength(1)
    expect(result.current[0]).toEqual({
      role: 'admin',
      label: 'Panel Admin',
      href: '/admin/dashboard',
      priority: 3,
    })
  })

  it('returns exactly 1 item for director-only user', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      claims: { roles: ['director'] },
    })

    const { result } = renderHook(() => useRoleNavigation())
    expect(result.current).toHaveLength(1)
    expect(result.current[0]).toEqual({
      role: 'director',
      label: 'Dashboard BI',
      href: '/director/dashboard',
      priority: 4,
    })
  })

  it('returns exactly 1 item for superadmin-only user', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      claims: { roles: ['superadmin'] },
    })

    const { result } = renderHook(() => useRoleNavigation())
    expect(result.current).toHaveLength(1)
    expect(result.current[0]).toEqual({
      role: 'superadmin',
      label: 'Gestion',
      href: '/superadmin/users',
      priority: 5,
    })
  })

  it('returns items sorted by priority descending for multi-role user', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      claims: { roles: ['cliente', 'agente', 'admin'] },
    })

    const { result } = renderHook(() => useRoleNavigation())
    // admin(3): 1 item + agente(2): 3 items + cliente(1): 2 items = 6 total
    expect(result.current).toHaveLength(6)

    // First item should be admin (priority 3)
    expect(result.current[0].role).toBe('admin')
    // Then agente items (priority 2)
    expect(result.current[1].role).toBe('agente')
    expect(result.current[2].role).toBe('agente')
    expect(result.current[3].role).toBe('agente')
    // Then cliente items (priority 1)
    expect(result.current[4].role).toBe('cliente')
    expect(result.current[5].role).toBe('cliente')

    // Verify strict descending order
    for (let i = 1; i < result.current.length; i++) {
      expect(result.current[i - 1].priority).toBeGreaterThanOrEqual(result.current[i].priority)
    }
  })

  it('returns all items for user with all 5 roles', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      claims: { roles: ['cliente', 'agente', 'admin', 'director', 'superadmin'] },
    })

    const { result } = renderHook(() => useRoleNavigation())
    // superadmin(1) + director(1) + admin(1) + agente(3) + cliente(2) = 8
    expect(result.current).toHaveLength(8)
    // First should be superadmin (priority 5)
    expect(result.current[0].role).toBe('superadmin')
  })
})
