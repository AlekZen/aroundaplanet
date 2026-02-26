'use client'

import { useEffect } from 'react'
import { onIdTokenChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase/auth'
import { getUserProfile } from '@/lib/firebase/firestore'
import { useAuthStore } from '@/stores/useAuthStore'

export function AuthInitializer() {
  const setUser = useAuthStore((s) => s.setUser)
  const setProfile = useAuthStore((s) => s.setProfile)
  const setLoading = useAuthStore((s) => s.setLoading)
  const reset = useAuthStore((s) => s.reset)

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (user) {
        try {
          const profile = await getUserProfile(user.uid)
          setUser(user)
          setProfile(profile)
        } catch {
          // Firestore unreachable — set user without profile
          setUser(user)
          setProfile(null)
        }
        try {
          const idToken = await user.getIdToken()
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          })
        } catch {
          // Session cookie sync failed — non-blocking, proxy.ts handles in 1.4b
        }
      } else {
        reset()
        try {
          await fetch('/api/auth/session', { method: 'DELETE' })
        } catch {
          // Cookie clear failed — non-blocking
        }
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [setUser, setProfile, setLoading, reset])

  return null
}
