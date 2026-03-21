'use client'

import { useCallback, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Search, Users, RefreshCw, Phone, Mail, MapPin,
  ChevronRight, ShoppingBag, CreditCard,
} from 'lucide-react'
import type { AgentClient, AgentClientsResponse, AgentClientOrder } from '@/app/api/agents/[agentId]/clients/route'

const PAYMENT_STATE_LABELS: Record<string, string> = {
  paid: 'Pagado',
  partial: 'Parcial',
  not_paid: 'Sin pagar',
  in_payment: 'En proceso',
}

const PAYMENT_STATE_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  not_paid: 'bg-red-100 text-red-800',
  in_payment: 'bg-blue-100 text-blue-800',
}

function formatMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

interface AgentClientListProps {
  agentId: string
  /** Title override for when used in superadmin context */
  title?: string
  /** Hide the header section (used when embedded in superadmin) */
  hideHeader?: boolean
}

export function AgentClientList({ agentId, title, hideHeader }: AgentClientListProps) {
  const [data, setData] = useState<AgentClientsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<AgentClient | null>(null)

  const fetchClients = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/clients`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? `Error HTTP ${res.status}`)
      }
      const result: AgentClientsResponse = await res.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar clientes')
    } finally {
      setIsLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const filtered = search.trim()
    ? (data?.clients ?? []).filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.city?.toLowerCase().includes(search.toLowerCase())
      )
    : (data?.clients ?? [])

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
            {title ?? 'Mis Clientes'}
          </h1>
          <p className="text-muted-foreground">
            Clientes asignados a tu cartera desde Odoo.
          </p>
        </div>
      )}

      {/* Summary cards */}
      {data && !isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Clientes</p>
              <p className="text-2xl font-bold">{data.summary.totalClients}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Ordenes</p>
              <p className="text-2xl font-bold text-blue-700">{data.summary.totalOrders}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Total vendido</p>
              <p className="text-lg font-bold text-green-700 font-mono">{formatMXN(data.summary.totalAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Por cobrar</p>
              <p className="text-lg font-bold text-orange-700 font-mono">{formatMXN(data.summary.totalResidual)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search + refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email o ciudad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchClients}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
            Error al cargar clientes
          </h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={fetchClients}>Reintentar</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
            {search ? 'Sin resultados' : 'Sin clientes asignados'}
          </h2>
          <p className="text-muted-foreground max-w-md">
            {search
              ? `No se encontraron clientes que coincidan con "${search}".`
              : 'Aun no tienes clientes asignados en Odoo. Cuando te asignen ordenes de venta, tus clientes apareceran aqui.'
            }
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead className="text-right">Ordenes</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado pago</TableHead>
                    <TableHead>Ultima orden</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((client) => (
                    <TableRow
                      key={client.partnerId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedClient(client)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{client.name}</p>
                          {client.email && (
                            <p className="text-xs text-muted-foreground">{client.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {client.city ?? '-'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {client.orderCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-mono">
                        {formatMXN(client.totalAmount)}
                      </TableCell>
                      <TableCell>
                        {client.latestPaymentState && (
                          <Badge className={PAYMENT_STATE_COLORS[client.latestPaymentState] ?? ''}>
                            {PAYMENT_STATE_LABELS[client.latestPaymentState] ?? client.latestPaymentState}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(client.lastOrderDate)}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((client) => (
              <button
                type="button"
                key={client.partnerId}
                className="w-full rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedClient(client)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{client.name}</p>
                    {client.city && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {client.city}
                      </p>
                    )}
                  </div>
                  {client.latestPaymentState && (
                    <Badge className={`shrink-0 ${PAYMENT_STATE_COLORS[client.latestPaymentState] ?? ''}`}>
                      {PAYMENT_STATE_LABELS[client.latestPaymentState] ?? client.latestPaymentState}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="text-muted-foreground">
                    {client.orderCount} {client.orderCount === 1 ? 'orden' : 'ordenes'}
                  </span>
                  <span className="font-mono font-medium">{formatMXN(client.totalAmount)}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Client detail sheet */}
      <ClientDetailSheet
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
      />
    </div>
  )
}

function ClientDetailSheet({
  client,
  onClose,
}: {
  client: AgentClient | null
  onClose: () => void
}) {
  if (!client) return null

  return (
    <Sheet open={!!client} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">{client.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact info */}
          <div className="space-y-2">
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <Mail className="h-4 w-4" />
                {client.email}
              </a>
            )}
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <Phone className="h-4 w-4" />
                {client.phone}
              </a>
            )}
            {client.city && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {client.city}
              </p>
            )}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-3 pb-2 px-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Total vendido
                </div>
                <p className="text-lg font-bold font-mono">{formatMXN(client.totalAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-2 px-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  Por cobrar
                </div>
                <p className="text-lg font-bold font-mono text-orange-700">{formatMXN(client.totalResidual)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Orders list */}
          <div className="space-y-3">
            <h3 className="font-heading text-sm font-semibold text-foreground">
              Ordenes ({client.orders.length})
            </h3>
            <div className="space-y-2">
              {client.orders.map((order) => (
                <OrderCard key={order.orderId} order={order} />
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function OrderCard({ order }: { order: AgentClientOrder }) {
  return (
    <Card className="p-3">
      <CardContent className="p-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{order.orderName}</span>
          {order.paymentState && (
            <Badge className={`text-xs ${PAYMENT_STATE_COLORS[order.paymentState] ?? ''}`}>
              {PAYMENT_STATE_LABELS[order.paymentState] ?? order.paymentState}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono">{formatMXN(order.amountTotal)}</span>
          <span className="text-xs text-muted-foreground">{formatDate(order.dateOrder)}</span>
        </div>
        {order.amountResidual > 0 && (
          <p className="text-xs text-orange-600">
            Pendiente: {formatMXN(order.amountResidual)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
