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
import { MapPin } from 'lucide-react'
import type { UnifiedClient } from '@/schemas/contactSchema'
import type { TripGroup } from './grouping'
import {
  formatMXN, formatDate,
  PAYMENT_STATE_LABELS, PAYMENT_STATE_COLORS,
} from './client-utils'

interface GroupedByTripViewProps {
  tripGroups: TripGroup[]
  onClientClick: (client: UnifiedClient) => void
}

export function GroupedByTripView({ tripGroups, onClientClick }: GroupedByTripViewProps) {
  if (tripGroups.length === 0) return null

  return (
    <Accordion type="multiple" className="space-y-2">
      {tripGroups.map((group) => {
        const key = group.tripId ?? '_no_trip'
        return (
          <AccordionItem key={key} value={key} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                <span className="font-medium">{group.tripName}</span>
                <Badge variant="secondary" className="text-xs">
                  {group.clients.length} {group.clients.length === 1 ? 'cliente' : 'clientes'}
                </Badge>
                <span className="text-sm font-mono text-muted-foreground">
                  {formatMXN(group.totalAmount)}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {/* Desktop table (F10) */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Fuente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.clients.map(({ client, orders }) => (
                      <TableRow
                        key={`${client.source}-${client.id}`}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => onClientClick(client)}
                      >
                        <TableCell>
                          <p className="font-medium">{client.name}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {client.email ?? client.phone ?? '-'}
                        </TableCell>
                        <TableCell>
                          {orders.map((o) => {
                            if (o.source === 'odoo' && o.paymentState) {
                              return (
                                <Badge
                                  key={o.orderId}
                                  className={`text-xs mr-1 ${PAYMENT_STATE_COLORS[o.paymentState] ?? ''}`}
                                >
                                  {PAYMENT_STATE_LABELS[o.paymentState] ?? o.paymentState}
                                </Badge>
                              )
                            }
                            if (o.source === 'platform' && o.status) {
                              return (
                                <Badge key={o.orderId} variant="outline" className="text-xs mr-1">
                                  {o.status}
                                </Badge>
                              )
                            }
                            return null
                          })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-mono">
                          {formatMXN(orders.reduce((sum, o) => sum + o.amountTotal, 0))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={client.source === 'platform' ? 'default' : 'secondary'}
                            className={client.source === 'platform' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}
                          >
                            {client.source === 'platform' ? 'Plataforma' : 'Odoo'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards (F10) */}
              <div className="md:hidden space-y-2">
                {group.clients.map(({ client, orders }) => (
                  <button
                    type="button"
                    key={`${client.source}-${client.id}`}
                    className="w-full rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => onClientClick(client)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{client.name}</p>
                        {client.city && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" /> {client.city}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={client.source === 'platform' ? 'default' : 'secondary'}
                        className={`shrink-0 ${client.source === 'platform' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}
                      >
                        {client.source === 'platform' ? 'Plataforma' : 'Odoo'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <div className="flex gap-1 flex-wrap">
                        {orders.map((o) => {
                          if (o.source === 'odoo' && o.paymentState) {
                            return (
                              <Badge
                                key={o.orderId}
                                className={`text-xs ${PAYMENT_STATE_COLORS[o.paymentState] ?? ''}`}
                              >
                                {PAYMENT_STATE_LABELS[o.paymentState] ?? o.paymentState}
                              </Badge>
                            )
                          }
                          if (o.source === 'platform' && o.status) {
                            return (
                              <Badge key={o.orderId} variant="outline" className="text-xs">
                                {o.status}
                              </Badge>
                            )
                          }
                          return null
                        })}
                      </div>
                      <span className="font-mono font-medium">
                        {formatMXN(orders.reduce((sum, o) => sum + o.amountTotal, 0))}
                      </span>
                    </div>
                    {orders.length > 0 && orders[0].dateOrder && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(orders[0].dateOrder)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
