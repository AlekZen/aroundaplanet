import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './useAuthStore'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      profile: null,
      isLoading: true,
      isAuthenticated: false,
      error: null,
    })
  })

  it('initializes with loading true and not authenticated', () => {
    const state = useAuthStore.getState()
    expect(state.isLoading).toBe(true)
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.profile).toBeNull()
    expect(state.error).toBeNull()
  })

  it('setUser updates user and isAuthenticated', () => {
    const mockUser = { uid: '123', email: 'test@example.com' } as never
    useAuthStore.getState().setUser(mockUser)

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
  })

  it('setUser with null marks not authenticated', () => {
    const mockUser = { uid: '123' } as never
    useAuthStore.getState().setUser(mockUser)
    useAuthStore.getState().setUser(null)

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('setProfile updates profile', () => {
    const mockProfile = {
      uid: '123',
      email: 'test@example.com',
      displayName: 'Test',
      roles: ['cliente'],
    } as never
    useAuthStore.getState().setProfile(mockProfile)

    expect(useAuthStore.getState().profile).toEqual(mockProfile)
  })

  it('setLoading updates isLoading', () => {
    useAuthStore.getState().setLoading(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('setError updates error', () => {
    useAuthStore.getState().setError('Auth failed')
    expect(useAuthStore.getState().error).toBe('Auth failed')
  })

  it('reset clears user, profile, auth status, and error', () => {
    const mockUser = { uid: '123' } as never
    useAuthStore.getState().setUser(mockUser)
    useAuthStore.getState().setError('some error')

    useAuthStore.getState().reset()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.profile).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.error).toBeNull()
  })
})
