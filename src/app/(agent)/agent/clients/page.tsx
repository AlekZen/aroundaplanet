'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { Skeleton } from '@/components/ui/skeleton'
import { NoAgentIdEmptyState } from '@/components/custom/NoAgentIdEmptyState'
import { AgentClientList } from './AgentClientList'

export default function AgentClientsPage() {
  const { claims, profile, user } = useAuthStore()
  // claims.agentId from Firebase ID token (may lag after setCustomUserClaims).
  // profile.agentId from Firestore (updated immediately by setUserClaims).
  const localAgentId = claims?.agentId ?? profile?.agentId

  // If client-side claims don't have agentId yet (Firebase propagation delay),
  // fetch from server where claims are always up-to-date via session cookie.
  const [serverAgentId, setServerAgentId] = useState<string | null>(null)
  const [serverChecked, setServerChecked] = useState(false)

  useEffect(() => {
    if (localAgentId || !user) return
    let cancelled = false
    fetch('/api/auth/claims')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data?.agentId) {
          setServerAgentId(data.agentId)
        }
        if (!cancelled) setServerChecked(true)
      })
      .catch(() => { if (!cancelled) setServerChecked(true) })
    return () => { cancelled = true }
  }, [localAgentId, user])

  const agentId = localAgentId ?? serverAgentId
  const checked = Boolean(localAgentId) || !user || serverChecked

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
    const isAdmin = claims?.roles?.some((r) => ['admin', 'director', 'superadmin'].includes(r)) ?? false
    return <NoAgentIdEmptyState userRole={isAdmin ? 'admin' : 'agente'} />
  }

  return <AgentClientList agentId={agentId} />
}
