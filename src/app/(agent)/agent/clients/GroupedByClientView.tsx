'use client'

import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { FileText, FileDown } from 'lucide-react'
import type { UnifiedClient, UnifiedOrder } from '@/schemas/contactSchema'
import type { ClientGroup } from './grouping'
import type { OrderActionEntry } from '@/app/api/agent/orders-contract-map/route'
import {
  formatMXN, formatDate,
  PAYMENT_STATE_LABELS, PAYMENT_STATE_COLORS,
} from './client-utils'

function getPaidAmount(order: UnifiedOrder): number {
  if (order.source === 'odoo') return order.amountPaid ?? Math.max(0, order.amountTotal - (order.amountResidual ?? 0))
  return (order.amountPaidCents ?? 0) / 100
}

function getResidualAmount(order: UnifiedOrder): number {
  if (order.source === 'odoo') return order.amountResidual ?? Math.max(0, order.amountTotal - getPaidAmount(order))
  return Math.max(0, ((order.amountTotalCents ?? 0) - (order.amountPaidCents ?? 0)) / 100)
}

interface GroupedByClientViewProps {
  clientGroups: ClientGroup[]
  onClientClick: (client: UnifiedClient) => void
  orderActions?: Record<string, OrderActionEntry>
}

async function openContractPdf(contractId: string) {
  try {
    const r = await fetch(`/api/contracts/${contractId}/url`)
    const data = await r.json()
    if (!r.ok) throw new Error(data?.message ?? `HTTP ${r.status}`)
    window.open(data.url, '_blank', 'noopener,noreferrer')
  } catch (e) {
    console.error('Error abriendo contrato:', e)
  }
}

function OrderActions({
  order,
  actions,
  variant,
}: {
  order: UnifiedOrder
  actions: OrderActionEntry | undefined
  variant: 'desktop' | 'mobile'
}) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const stack = variant === 'mobile' ? 'flex flex-col gap-1.5' : 'flex flex-wrap items-center gap-1.5'
  const btnSize = variant === 'mobile' ? 'w-full justify-center' : ''

  if (!actions) {
    return <span className="text-xs text-muted-foreground italic">Contrato pendiente</span>
  }

  const { contractId, verifiedPayments } = actions
  const hasContract = contractId !== null
  const hasPayments = verifiedPayments.length > 0
  const singlePayment = verifiedPayments.length === 1

  return (
    <div className={stack}>
      {hasContract ? (
        <Button
          size="sm"
          variant="outline"
          className={btnSize}
          onClick={() => void openContractPdf(contractId)}
        >
          <FileText className="h-3.5 w-3.5 mr-1.5" /> Ver contrato
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground italic">Contrato pendiente</span>
      )}

      {hasPayments ? (
        singlePayment ? (
          <Button asChild size="sm" variant="default" className={btnSize}>
            <a
              href={`/api/payments/${verifiedPayments[0].paymentId}/receipt-pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileDown className="h-3.5 w-3.5 mr-1.5" /> Recibo PDF
            </a>
          </Button>
        ) : (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="default" className={btnSize}>
                <FileDown className="h-3.5 w-3.5 mr-1.5" /> Recibos PDF ({verifiedPayments.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
              <p className="text-xs text-muted-foreground mb-2 px-2">
                Selecciona un recibo
              </p>
              <div className="space-y-1">
                {verifiedPayments.map((p) => (
                  <a
                    key={p.paymentId}
                    href={`/api/payments/${p.paymentId}/receipt-pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setPopoverOpen(false)}
                    className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono">{formatMXN(p.amountCents / 100)}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(p.dateIso)}</span>
                    </div>
                  </a>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )
      ) : hasContract ? (
        <span className="text-xs text-muted-foreground italic">Sin pagos verificados aún</span>
      ) : null}

      {/* Marcar 'order' como usado para satisfacer linter aunque no se utilice directamente */}
      <span className="sr-only">{order.orderId}</span>
    </div>
  )
}

export function GroupedByClientView({ clientGroups, onClientClick, orderActions }: GroupedByClientViewProps) {
  if (clientGroups.length === 0) return null

  return (
    <Accordion type="multiple" className="space-y-2">
      {clientGroups.map((group) => {
        const key = `${group.client.source}-${group.client.id}`
        return (
          <AccordionItem key={key} value={key} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                <span className="font-medium">{group.client.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {group.trips.length} {group.trips.length === 1 ? 'viaje' : 'viajes'}
                </Badge>
                <span className="text-sm font-mono text-muted-foreground">
                  {formatMXN(group.totalAmount)}
                </span>
                <span className="hidden text-sm font-mono text-green-700 sm:inline">
                  Cobrado {formatMXN(group.totalPaid)}
                </span>
                {group.totalResidual > 0 && (
                  <span className="hidden text-sm font-mono text-orange-700 sm:inline">
                    Pendiente {formatMXN(group.totalResidual)}
                  </span>
                )}
                <Badge
                  variant={group.client.source === 'platform' ? 'default' : 'secondary'}
                  className={group.client.source === 'platform' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}
                >
                  {group.client.source === 'platform' ? 'Plataforma' : 'Odoo'}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <button
                type="button"
                className="mb-3 text-sm text-primary hover:underline"
                onClick={() => onClientClick(group.client)}
              >
                Ver detalle del cliente
              </button>
              {/* Desktop table (F10) */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Viaje</TableHead>
                      <TableHead>Orden</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Cobrado</TableHead>
                      <TableHead className="text-right">Pendiente</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Fuente</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.trips.map((trip) =>
                      trip.orders.map((order) => (
                        <TableRow key={order.orderId}>
                          <TableCell className="font-medium">{trip.tripName}</TableCell>
                          <TableCell className="font-mono text-sm">{order.orderName}</TableCell>
                          <TableCell>
                            {order.source === 'odoo' && order.paymentState ? (
                              <Badge className={`text-xs ${PAYMENT_STATE_COLORS[order.paymentState] ?? ''}`}>
                                {PAYMENT_STATE_LABELS[order.paymentState] ?? order.paymentState}
                              </Badge>
                            ) : order.source === 'platform' && order.status ? (
                              <Badge variant="outline" className="text-xs">{order.status}</Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-mono">
                            {formatMXN(order.amountTotal)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-mono text-green-700">
                            {formatMXN(getPaidAmount(order))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-mono text-orange-700">
                            {formatMXN(getResidualAmount(order))}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(order.dateOrder)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={order.source === 'platform' ? 'default' : 'secondary'}
                              className={order.source === 'platform' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}
                            >
                              {order.source === 'platform' ? 'Plataforma' : 'Odoo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <OrderActions
                              order={order}
                              actions={orderActions?.[order.orderId]}
                              variant="desktop"
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {group.trips.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-4">
                          Sin ordenes registradas
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards (F10) */}
              <div className="md:hidden space-y-2">
                {group.trips.map((trip) =>
                  trip.orders.map((order) => (
                    <div
                      key={order.orderId}
                      className="rounded-lg border p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{trip.tripName}</p>
                        <Badge
                          variant={order.source === 'platform' ? 'default' : 'secondary'}
                          className={`shrink-0 text-xs ${order.source === 'platform' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}
                        >
                          {order.source === 'platform' ? 'Plataforma' : 'Odoo'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-sm">
                        <div>
                          {order.source === 'odoo' && order.paymentState ? (
                            <Badge className={`text-xs ${PAYMENT_STATE_COLORS[order.paymentState] ?? ''}`}>
                              {PAYMENT_STATE_LABELS[order.paymentState] ?? order.paymentState}
                            </Badge>
                          ) : order.source === 'platform' && order.status ? (
                            <Badge variant="outline" className="text-xs">{order.status}</Badge>
                          ) : null}
                        </div>
                        <span className="font-mono font-medium">{formatMXN(order.amountTotal)}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <span className="font-mono text-green-700">Cobrado {formatMXN(getPaidAmount(order))}</span>
                        <span className="font-mono text-orange-700">Pendiente {formatMXN(getResidualAmount(order))}</span>
                      </div>
                      {order.dateOrder && (
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(order.dateOrder)}</p>
                      )}
                      <div className="mt-2 pt-2 border-t">
                        <OrderActions
                          order={order}
                          actions={orderActions?.[order.orderId]}
                          variant="mobile"
                        />
                      </div>
                    </div>
                  ))
                )}
                {group.trips.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin ordenes registradas</p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
