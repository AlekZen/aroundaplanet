'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

interface CommissionItem {
  id: string
  clientName: string
  tripName: string
  paymentAmountCents: number
  commissionAmountCents: number
  status: 'approved' | 'paid'
  createdAt: { _seconds: number } | string
}

function formatMXN(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDate(createdAt: { _seconds: number } | string): string {
  const date = typeof createdAt === 'string'
    ? new Date(createdAt)
    : new Date(createdAt._seconds * 1000)
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_CONFIG = {
  approved: { label: 'Aprobada', variant: 'default' as const },
  paid: { label: 'Pagada', variant: 'secondary' as const },
}

export function CommissionList({ agentId }: { agentId?: string }) {
  const [commissions, setCommissions] = useState<CommissionItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const params = agentId ? `?agentId=${agentId}` : ''
        const res = await fetch(`/api/commissions${params}`)
        if (!res.ok) return
        const data = await res.json()
        setCommissions(data.commissions ?? [])
      } catch {
        // Silent fail — dashboard metrics are the primary display
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Mis Comisiones</h2>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (commissions.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Mis Comisiones</h2>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no tienes comisiones. Cuando se verifiquen pagos de tus clientes, aparecerán aquí.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-lg font-semibold">Mis Comisiones</h2>

      {/* Mobile: Cards */}
      <div className="space-y-3 md:hidden">
        {commissions.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{c.clientName || 'Cliente'}</p>
                <Badge variant={STATUS_CONFIG[c.status].variant}>
                  {STATUS_CONFIG[c.status].label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{c.tripName}</p>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Pago: {formatMXN(c.paymentAmountCents)}</span>
                <span className="font-mono font-semibold">{formatMXN(c.commissionAmountCents)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Cliente</th>
              <th className="pb-2 font-medium">Viaje</th>
              <th className="pb-2 font-medium text-right">Monto Pago</th>
              <th className="pb-2 font-medium text-right">Comisión</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="py-3">{c.clientName || 'Cliente'}</td>
                <td className="py-3 text-muted-foreground">{c.tripName}</td>
                <td className="py-3 text-right font-mono">{formatMXN(c.paymentAmountCents)}</td>
                <td className="py-3 text-right font-mono font-semibold">{formatMXN(c.commissionAmountCents)}</td>
                <td className="py-3">
                  <Badge variant={STATUS_CONFIG[c.status].variant}>
                    {STATUS_CONFIG[c.status].label}
                  </Badge>
                </td>
                <td className="py-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
