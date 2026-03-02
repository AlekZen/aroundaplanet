'use client'

import { Suspense } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { CatalogSkeleton } from '@/app/(public)/viajes/CatalogSkeleton'
import { AgentCatalogContent } from './AgentCatalogContent'

export default function AgentCatalogPage() {
  const { claims } = useAuthStore()
  const agentId = claims?.agentId

  if (!agentId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
          Sin acceso al catalogo
        </h2>
        <p className="text-muted-foreground max-w-md">
          Tu cuenta no tiene un agentId asignado. Contacta al administrador.
        </p>
      </div>
    )
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
