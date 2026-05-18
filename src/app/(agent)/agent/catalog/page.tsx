'use client'

import { Suspense } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { CatalogSkeleton } from '@/app/(public)/viajes/CatalogSkeleton'
import { NoAgentIdEmptyState } from '@/components/custom/NoAgentIdEmptyState'
import { AgentCatalogContent } from './AgentCatalogContent'

export default function AgentCatalogPage() {
  const { claims } = useAuthStore()
  const agentId = claims?.agentId
  const isAdmin = claims?.roles?.some((r) => ['admin', 'director', 'superadmin'].includes(r)) ?? false

  if (!agentId) {
    return <NoAgentIdEmptyState userRole={isAdmin ? 'admin' : 'agente'} />
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Mi Catalogo
        </h1>
        <p className="text-muted-foreground">
          Toca &quot;Copiar Link&quot; en cualquier viaje para compartir tu link de referido.
        </p>
      </div>

      <Suspense fallback={<CatalogSkeleton />}>
        <AgentCatalogContent agentId={agentId} />
      </Suspense>
    </div>
  )
}
