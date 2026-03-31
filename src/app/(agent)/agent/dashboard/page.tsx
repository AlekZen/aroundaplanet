'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/useAuthStore'
import { CommissionList } from './CommissionList'
import type { AgentMetrics } from '@/types/commission'

function formatMXN(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

export default function AgentDashboardPage() {
  const claims = useAuthStore((s) => s.claims)
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async (agentId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/metrics`)
      if (!res.ok) throw new Error('Error al cargar métricas')
      const data = await res.json()
      setMetrics(data)
    } catch {
      setError('No se pudieron cargar las métricas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (claims?.agentId) {
      fetchMetrics(claims.agentId)
    } else if (claims) {
      setLoading(false)
    }
  }, [claims, fetchMetrics])

  // F9: agentId null/undefined — error descriptivo, nunca skeleton infinito
  if (claims && !claims.agentId) {
    return (
      <div className="space-y-6 p-4">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Mi Negocio</h1>
        <Card className="border-destructive">
          <CardContent className="p-6 text-center space-y-2">
            <p className="text-sm text-destructive">
              No se encontró tu perfil de agente. Contacta a soporte para vincular tu cuenta.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const metricCards = [
    { title: 'Ventas Verificadas', value: metrics ? formatMXN(metrics.verifiedSalesCents) : null, mono: true },
    { title: 'Clientes Activos', value: metrics ? String(metrics.activeClients) : null, mono: false },
    { title: 'Comisiones Pendientes', value: metrics ? formatMXN(metrics.pendingCommissionsCents) : null, mono: true },
    { title: 'Comisiones Ganadas', value: metrics ? formatMXN(metrics.earnedCommissionsCents) : null, mono: true },
  ]

  return (
    <div className="space-y-6 p-4">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Mi Negocio</h1>

      {error ? (
        <Card className="border-destructive">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => claims?.agentId && fetchMetrics(claims.agentId)}
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {metricCards.map((card) => (
            <Card key={card.title} className="p-4">
              <CardContent className="p-0 space-y-2">
                <p className="text-xs text-muted-foreground">{card.title}</p>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className={`text-xl font-semibold ${card.mono ? 'font-mono' : ''}`}>
                    {card.value}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CommissionList agentId={claims?.agentId} />
    </div>
  )
}
