'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CommissionItem {
  id: string
  agentId: string
  clientName: string
  tripName: string
  paymentAmountCents: number
  commissionAmountCents: number
  status: 'pending' | 'approved' | 'paid'
  period: string
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
  pending: { label: 'Pendiente', variant: 'outline' as const },
  approved: { label: 'Aprobada', variant: 'default' as const },
  paid: { label: 'Pagada', variant: 'secondary' as const },
}

export default function AdminCommissionsPage() {
  const [commissions, setCommissions] = useState<CommissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [periodFilter, setPeriodFilter] = useState<string>('')
  const [confirmAction, setConfirmAction] = useState<{
    commission: CommissionItem
    newStatus: 'approved' | 'paid'
    adjustedAmount?: number
  } | null>(null)
  const [adjustAmounts, setAdjustAmounts] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState(false)

  const fetchCommissions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (periodFilter) params.set('period', periodFilter)

      const res = await fetch(`/api/commissions?${params}`)
      if (!res.ok) throw new Error('Error al cargar comisiones')
      const data = await res.json()
      setCommissions(data.commissions ?? [])
    } catch {
      toast.error('No se pudieron cargar las comisiones')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, periodFilter])

  useEffect(() => {
    fetchCommissions()
  }, [fetchCommissions])

  const handleAction = async () => {
    if (!confirmAction) return
    setActionLoading(true)

    try {
      const body: Record<string, unknown> = { status: confirmAction.newStatus }
      if (confirmAction.adjustedAmount !== undefined) {
        body.commissionAmountCents = confirmAction.adjustedAmount
      }

      const res = await fetch(`/api/commissions/${confirmAction.commission.id}?agentId=${confirmAction.commission.agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Error al actualizar')
      }

      toast.success(
        confirmAction.newStatus === 'approved'
          ? 'Comisión aprobada'
          : 'Comisión marcada como pagada'
      )
      setConfirmAction(null)
      fetchCommissions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar comisión')
    } finally {
      setActionLoading(false)
    }
  }

  // Generate period options (last 12 months)
  const periodOptions: string[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    periodOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Comisiones</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="approved">Aprobadas</SelectItem>
            <SelectItem value="paid">Pagadas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={periodFilter || 'all'} onValueChange={(v) => setPeriodFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {periodOptions.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : commissions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No se encontraron comisiones con estos filtros.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Agente</th>
                <th className="pb-2 font-medium">Cliente</th>
                <th className="pb-2 font-medium">Viaje</th>
                <th className="pb-2 font-medium text-right">Monto Pago</th>
                <th className="pb-2 font-medium text-right">Comisión</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Fecha</th>
                <th className="pb-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-3 text-xs text-muted-foreground">{c.agentId}</td>
                  <td className="py-3">{c.clientName || 'N/A'}</td>
                  <td className="py-3 text-muted-foreground">{c.tripName}</td>
                  <td className="py-3 text-right font-mono">{formatMXN(c.paymentAmountCents)}</td>
                  <td className="py-3 text-right font-mono font-semibold">
                    {c.status === 'pending' ? (
                      <Input
                        type="number"
                        className="w-24 text-right text-xs ml-auto"
                        defaultValue={c.commissionAmountCents / 100}
                        onChange={(e) =>
                          setAdjustAmounts((prev) => ({
                            ...prev,
                            [c.id]: e.target.value,
                          }))
                        }
                      />
                    ) : (
                      formatMXN(c.commissionAmountCents)
                    )}
                  </td>
                  <td className="py-3">
                    <Badge variant={STATUS_CONFIG[c.status].variant}>
                      {STATUS_CONFIG[c.status].label}
                    </Badge>
                  </td>
                  <td className="py-3 text-muted-foreground text-xs">{formatDate(c.createdAt)}</td>
                  <td className="py-3">
                    {c.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          const raw = adjustAmounts[c.id]
                          let adjustedAmount: number | undefined
                          if (raw) {
                            const parsed = parseFloat(raw)
                            if (isNaN(parsed) || parsed <= 0) {
                              toast.error('El monto debe ser un número positivo')
                              return
                            }
                            adjustedAmount = Math.round(parsed * 100)
                          }
                          setConfirmAction({
                            commission: c,
                            newStatus: 'approved',
                            adjustedAmount,
                          })
                        }}
                      >
                        Aprobar
                      </Button>
                    )}
                    {c.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setConfirmAction({
                            commission: c,
                            newStatus: 'paid',
                          })
                        }
                      >
                        Marcar Pagada
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.newStatus === 'approved' ? 'Aprobar comisión' : 'Marcar como pagada'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.newStatus === 'approved'
                ? `¿Aprobar comisión de ${confirmAction?.commission.clientName || 'N/A'} por ${formatMXN(confirmAction?.adjustedAmount ?? confirmAction?.commission.commissionAmountCents ?? 0)}?`
                : `¿Marcar como pagada la comisión de ${confirmAction?.commission.clientName || 'N/A'}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button onClick={handleAction} disabled={actionLoading}>
              {actionLoading ? 'Procesando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
