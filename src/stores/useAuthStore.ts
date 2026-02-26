import { create } from 'zustand'
import type { User } from 'firebase/auth'
import type { UserProfile, UserClaims, UserRole } from '@/types/user'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  claims: UserClaims | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  setUser: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  setClaims: (claims: UserClaims | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  claims: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
  setUser: (user) => set({ user, isAuthenticated: user !== null }),
  setProfile: (profile) => set({ profile }),
  setClaims: (claims) => set({ claims }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      user: null,
      profile: null,
      claims: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    }),
}))

/**
 * Selector: check if the current user has a specific role.
 * Reads from claims.roles (source of truth), falls back to profile.roles.
 */
export function hasRole(role: UserRole): boolean {
  const state = useAuthStore.getState()
  const roles = state.claims?.roles ?? state.profile?.roles ?? []
  return roles.includes(role)
}
