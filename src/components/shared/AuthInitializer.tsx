'use client'

import { useEffect } from 'react'
import { onIdTokenChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase/auth'
import { getUserProfile } from '@/lib/firebase/firestore'
import { useAuthStore } from '@/stores/useAuthStore'
import { userClaimsSchema } from '@/schemas/roleSchema'

export function AuthInitializer() {
  const setUser = useAuthStore((s) => s.setUser)
  const setProfile = useAuthStore((s) => s.setProfile)
  const setClaims = useAuthStore((s) => s.setClaims)
  const setLoading = useAuthStore((s) => s.setLoading)
  const reset = useAuthStore((s) => s.reset)

  useEffect(() => {
    let cancelled = false

    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (cancelled) return

      if (user) {
        try {
          const profile = await getUserProfile(user.uid)
          if (cancelled) return
          setUser(user)
          setProfile(profile)
        } catch {
          if (cancelled) return
          // Firestore unreachable — set user without profile
          setUser(user)
          setProfile(null)
        }

        try {
          // POST session cookie with ID token string
          const idToken = await user.getIdToken()
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          })
          if (cancelled) return

          // After session POST (which sets initial claims for new users),
          // force refresh to get token with claims, then read claims
          const tokenResult = await user.getIdTokenResult(true)
          if (cancelled) return

          // Validate claims with Zod (no unsafe casts)
          const parsed = userClaimsSchema.safeParse({
            roles: tokenResult.claims.roles,
            agentId: tokenResult.claims.agentId,
          })
          setClaims(parsed.success ? parsed.data : { roles: ['cliente'] })
        } catch {
          if (cancelled) return
          // Session/claims sync failed — fallback to profile roles if available
          const profile = useAuthStore.getState().profile
          if (profile?.roles?.length) {
            setClaims({ roles: profile.roles })
          } else {
            setClaims({ roles: ['cliente'] })
          }
        }
      } else {
        reset()
        try {
          await fetch('/api/auth/session', { method: 'DELETE' })
        } catch {
          // Cookie clear failed — non-blocking
        }
      }
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [setUser, setProfile, setClaims, setLoading, reset])

  return null
}
