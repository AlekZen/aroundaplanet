'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { STATUS_COLORS } from '@/config/orderStatus'
import { AgentSelectorDialog } from './AgentSelectorDialog'
import { toast } from 'sonner'

interface UnassignedOrder {
  id: string
  contactName: string
  contactPhone: string
  tripName: string
  status: string
  amountTotalCents: number
  createdAt: unknown
}

function timestampToDate(ts: unknown): Date | null {
  if (!ts || typeof ts !== 'object') return null
  const obj = ts as Record<string, unknown>
  const seconds = (obj.seconds ?? obj._seconds) as number | undefined
  return typeof seconds === 'number' ? new Date(seconds * 1000) : null
}

export function UnassignedLeadsPanel() {
  const [orders, setOrders] = useState<UnassignedOrder[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/orders/unassigned')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Error al cargar leads')
      }
      const data = await res.json()
      setOrders(data.orders ?? [])
      setTotal(data.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleAssign = useCallback(async (orderId: string, agentId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Error al asignar agente')
      }
      toast.success('Agente asignado correctamente', { duration: 4000 })
      setAssigningOrderId(null)
      fetchOrders()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al asignar', { duration: 4000 })
    }
  }, [fetchOrders])

  // Skeleton loading
  if (isLoading && orders.length === 0) {
    return (
      <div className="space-y-4" role="status" aria-label="Cargando leads">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={fetchOrders}>
          Reintentar
        </Button>
      </div>
    )
  }

  // Empty state
  if (orders.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">No hay leads sin asignar</p>
        <p className="mt-1 text-sm text-muted-foreground">Todos los leads tienen agente asignado</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contacto</TableHead>
              <TableHead>Telefono</TableHead>
              <TableHead>Viaje</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const date = timestampToDate(order.createdAt)
              return (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.contactName}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">{order.contactPhone}</span>
                  </TableCell>
                  <TableCell>{order.tripName}</TableCell>
                  <TableCell>{formatCurrency(order.amountTotalCents)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {order.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {date ? date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAssigningOrderId(order.id)}
                    >
                      Asignar
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        {orders.map((order) => {
          const date = timestampToDate(order.createdAt)
          return (
            <Card key={order.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{order.contactName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{order.contactPhone}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800'}`}>
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{order.tripName}</span>
                  <span className="font-semibold">{formatCurrency(order.amountTotalCents)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {date ? date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAssigningOrderId(order.id)}
                  >
                    Asignar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Count */}
      <div className="text-sm text-muted-foreground">
        {total} lead{total !== 1 ? 's' : ''} sin asignar
      </div>

      {/* Agent selector dialog */}
      <AgentSelectorDialog
        isOpen={!!assigningOrderId}
        onOpenChange={(open) => { if (!open) setAssigningOrderId(null) }}
        onSelect={(agentId) => {
          if (assigningOrderId) handleAssign(assigningOrderId, agentId)
        }}
      />
    </div>
  )
}
