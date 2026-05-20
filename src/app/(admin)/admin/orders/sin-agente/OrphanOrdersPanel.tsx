'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { AlertTriangle, Loader2, ExternalLink, RefreshCw, CheckCircle2 } from 'lucide-react'

interface OrphanOrder {
  orderId: string
  contactName: string | null
  tripName: string | null
  source: string | null
  status: string | null
  amountTotalCents: number
  amountPaidCents: number
  contractId: string | null
  createdAtIso: string | null
  verifiedPaymentCount: number
}

interface AgentOption {
  uid: string
  name: string
  email: string | null
}

function formatMxn(cents: number): string {
  const pesos = (cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return `$${pesos}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
  } catch {
    return iso
  }
}

/**
 * Story 10.6 B1 — Panel "Órdenes sin agente".
 *
 * Lista órdenes con `agentId` ausente y permite asignación por fila reutilizando
 * el endpoint /api/admin/orders/[orderId]/assign-agent (que ya hace backfill de
 * pagos verified + auto-share del contrato).
 */
export function OrphanOrdersPanel() {
  const [orders, setOrders] = useState<OrphanOrder[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [summary, setSummary] = useState<{ total: number; withContract: number; withVerifiedPayment: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<Record<string, string>>({})
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [ordersRes, agentsRes] = await Promise.all([
        fetch('/api/admin/orders/orphan').then((r) =>
          r.ok ? r.json() : Promise.reject(new Error(`Órdenes ${r.status}`))
        ),
        fetch('/api/admin/agents-list').then((r) =>
          r.ok ? r.json() : Promise.reject(new Error(`Agentes ${r.status}`))
        ),
      ])
      setOrders(ordersRes.orders ?? [])
      setSummary({
        total: ordersRes.total ?? 0,
        withContract: ordersRes.withContract ?? 0,
        withVerifiedPayment: ordersRes.withVerifiedPayment ?? 0,
      })
      setAgents(agentsRes.agents ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function handleAssign(orderId: string) {
    const agentId = selectedAgent[orderId]
    if (!agentId) return
    setAssigningId(orderId)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/assign-agent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? `Error ${res.status}`)
      toast.success(
        data.paymentsUpdated > 0
          ? `${data.agentName ?? 'Agente'} asignado · ${data.paymentsUpdated} pago(s) verified actualizados`
          : `${data.agentName ?? 'Agente'} asignado`
      )
      setDoneIds((prev) => new Set(prev).add(orderId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo asignar')
    } finally {
      setAssigningId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p>{error}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const remaining = orders.filter((o) => !doneIds.has(o.orderId))

  if (remaining.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
          <p className="font-medium">No hay órdenes sin agente</p>
          <p className="text-sm text-muted-foreground">
            Todas las órdenes con datos en plataforma tienen un agente asignado.
          </p>
          <Button size="sm" variant="outline" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refrescar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Sin agente</p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Con contrato</p>
              <p className="text-2xl font-bold text-orange-700">{summary.withContract}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Con pagos verified</p>
              <p className="text-2xl font-bold text-red-700">{summary.withVerifiedPayment}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Orden</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Viaje</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Indicadores</TableHead>
              <TableHead className="min-w-[280px]">Asignar agente</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {remaining.map((o) => (
              <TableRow key={o.orderId}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/admin/orders/${o.orderId}`} className="text-primary hover:underline inline-flex items-center gap-1">
                    {o.orderId.startsWith('odoo-sale-') ? `S${o.orderId.replace('odoo-sale-', '')}` : o.orderId.slice(0, 8)}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(o.createdAtIso)}</p>
                </TableCell>
                <TableCell>
                  <p className="font-medium text-sm">{o.contactName ?? '—'}</p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {o.tripName ?? '—'}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{formatMxn(o.amountTotalCents)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {o.contractId && (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">Contrato</Badge>
                    )}
                    {o.verifiedPaymentCount > 0 && (
                      <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">
                        {o.verifiedPaymentCount} pago{o.verifiedPaymentCount === 1 ? '' : 's'}
                      </Badge>
                    )}
                    {!o.contractId && o.verifiedPaymentCount === 0 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={selectedAgent[o.orderId] ?? ''}
                    onValueChange={(v) => setSelectedAgent((prev) => ({ ...prev, [o.orderId]: v }))}
                    disabled={assigningId === o.orderId}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecciona agente" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((a) => (
                        <SelectItem key={a.uid} value={a.uid}>
                          {a.name}
                          {a.email && <span className="text-xs text-muted-foreground ml-2">({a.email})</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    onClick={() => handleAssign(o.orderId)}
                    disabled={!selectedAgent[o.orderId] || assigningId === o.orderId}
                  >
                    {assigningId === o.orderId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Asignar'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {doneIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{doneIds.size} órden{doneIds.size === 1 ? '' : 'es'} asignada{doneIds.size === 1 ? '' : 's'} en esta sesión.</span>
        </div>
      )}
    </div>
  )
}
