'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { Skeleton } from '@/components/ui/skeleton'
import { AgentClientList } from './AgentClientList'

export default function AgentClientsPage() {
  const { claims, profile, user } = useAuthStore()
  // claims.agentId from Firebase ID token (may lag after setCustomUserClaims).
  // profile.agentId from Firestore (updated immediately by setUserClaims).
  const localAgentId = claims?.agentId ?? profile?.agentId

  // If client-side claims don't have agentId yet (Firebase propagation delay),
  // fetch from server where claims are always up-to-date via session cookie.
  const [serverAgentId, setServerAgentId] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (localAgentId) {
      setChecked(true)
      return
    }
    // Only fetch if we have a user but no agentId locally
    if (!user) {
      setChecked(true)
      return
    }
    let cancelled = false
    fetch('/api/auth/claims')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data?.agentId) {
          setServerAgentId(data.agentId)
        }
        if (!cancelled) setChecked(true)
      })
      .catch(() => { if (!cancelled) setChecked(true) })
    return () => { cancelled = true }
  }, [localAgentId, user])

  const agentId = localAgentId ?? serverAgentId

  if (!checked) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (!agentId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
          Sin acceso a clientes
        </h2>
        <p className="text-muted-foreground">
          Tu cuenta no tiene un agentId asignado. Contacta al administrador.
        </p>
      </div>
    )
  }

  return <AgentClientList agentId={agentId} />
}
