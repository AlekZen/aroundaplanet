'use client'

import { useState, useEffect } from 'react'
import { CatalogContent } from '@/app/(public)/viajes/CatalogContent'
import { CatalogSkeleton } from '@/app/(public)/viajes/CatalogSkeleton'
import type { PublicTrip } from '@/types/trip'

interface AgentCatalogContentProps {
  agentId: string
}

export function AgentCatalogContent({ agentId }: AgentCatalogContentProps) {
  const [trips, setTrips] = useState<PublicTrip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchTrips() {
      try {
        const res = await fetch('/api/trips/published')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) setTrips(data.trips ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error cargando viajes')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchTrips()
    return () => { cancelled = true }
  }, [])

  if (isLoading) return <CatalogSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
          Error al cargar el catalogo
        </h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    )
  }

  return <CatalogContent trips={trips} agentId={agentId} />
}
