'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ReceiptText, ExternalLink, AlertCircle } from 'lucide-react'
import { formatMXN, formatDate } from './client-utils'

interface VerifiedPayment {
  id: string
  orderId: string
  tripName: string | null
  clientName: string | null
  amountCents: number
  paymentMethod: string
  bankName: string | null
  bankReference: string | null
  receiptUrl: string | null
  verifiedAt: string | null
  createdAt: string | null
}

const METHOD_LABELS: Record<string, string> = {
  transfer: 'Transferencia',
  card: 'Tarjeta',
  cash: 'Efectivo',
  deposit: 'Depósito',
}

/**
 * Story 10.6 AC4 — Panel "Recibos verificados" en /agent/clients.
 *
 * Lista los pagos verificados de los clientes del agente con botón "Ver recibo"
 * que abre la URL del comprobante en nueva pestaña. Resuelve el reporte de
 * Noel (sesión 46): agente no podía descargar el recibo del pago verificado.
 *
 * Filas vacías: si el endpoint devuelve 403 (sin claim agentId) o lista vacía,
 * se muestra una pista accionable.
 */
export function AgentVerifiedPaymentsPanel() {
  const [items, setItems] = useState<VerifiedPayment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/agent/client-payments')
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          throw new Error(data.message ?? `Error ${r.status}`)
        }
        return r.json() as Promise<{ payments: VerifiedPayment[] }>
      })
      .then((data) => {
        if (!active) return
        setItems(data.payments)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Error al cargar recibos')
        setItems([])
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ReceiptText className="h-4 w-4" /> Recibos verificados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ReceiptText className="h-4 w-4" /> Recibos verificados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ReceiptText className="h-4 w-4" /> Recibos verificados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aún no tienes pagos verificados visibles. Si tu cliente ya pagó y administración aprobó,
            pídele a admin que asigne tu agente a la orden desde /admin/orders.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ReceiptText className="h-4 w-4" /> Recibos verificados
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((p) => (
          <div
            key={p.id}
            className="flex items-start justify-between gap-3 rounded-md border p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm truncate">{p.clientName ?? 'Cliente sin nombre'}</p>
                <Badge variant="outline" className="text-xs">{METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}</Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {p.tripName ?? 'Viaje sin nombre'}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="font-mono font-semibold text-foreground">
                  {formatMXN(p.amountCents / 100)}
                </span>
                {p.verifiedAt && <span>Verificado {formatDate(p.verifiedAt)}</span>}
                {p.bankReference && <span className="font-mono">Ref {p.bankReference}</span>}
              </div>
            </div>
            <div className="shrink-0">
              {p.receiptUrl ? (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                >
                  <a
                    href={p.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Ver recibo
                  </a>
                </Button>
              ) : (
                <Badge variant="secondary" className="text-xs">Sin recibo</Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
