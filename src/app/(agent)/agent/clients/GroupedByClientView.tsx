'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { UnifiedClient, UnifiedOrder } from '@/schemas/contactSchema'
import type { ClientGroup } from './grouping'
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
}

export function GroupedByClientView({ clientGroups, onClientClick }: GroupedByClientViewProps) {
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
                        </TableRow>
                      ))
                    )}
                    {group.trips.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-4">
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
