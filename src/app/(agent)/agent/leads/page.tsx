'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/useAuthStore'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { STATUS_COLORS } from '@/config/orderStatus'
import { Globe, Users, Plus, CreditCard, CheckCircle2, XCircle, Clock, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PaymentRegistrationForm } from '@/components/custom/PaymentRegistrationForm'
import { PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, type PaymentStatus, type PaymentMethod } from '@/schemas/paymentSchema'

interface AgentPayment {
  id: string
  orderId: string
  tripName: string | null
  amountCents: number
  paymentMethod: PaymentMethod
  status: PaymentStatus
  rejectionNote: string | null
  createdAt: string | null
}

const PAYMENT_STATUS_ICONS: Record<PaymentStatus, React.ReactNode> = {
  pending_verification: <Clock className="h-3.5 w-3.5 text-yellow-600" />,
  verified: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  rejected: <XCircle className="h-3.5 w-3.5 text-red-600" />,
  info_requested: <MessageSquare className="h-3.5 w-3.5 text-blue-600" />,
}

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending_verification: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  info_requested: 'bg-blue-100 text-blue-800',
}

interface AgentOrder {
  id: string
  contactName: string
  tripName: string
  status: string
  amountTotalCents: number
  createdAt: { _seconds?: number; seconds?: number } | null
}

function formatDate(ts: AgentOrder['createdAt']): string {
  if (!ts) return ''
  const seconds = ts._seconds ?? ts.seconds ?? 0
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function AgentLeadsPage() {
  const { claims } = useAuthStore()
  const agentId = claims?.agentId
  const [orders, setOrders] = useState<AgentOrder[]>([])
  const [payments, setPayments] = useState<AgentPayment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false)

  useEffect(() => {
    if (!agentId) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function fetchData() {
      try {
        const [ordersRes, paymentsRes] = await Promise.all([
          fetch(`/api/agents/${agentId}/orders`),
          fetch('/api/my-payments'),
        ])
        if (!ordersRes.ok) throw new Error(`HTTP ${ordersRes.status}`)
        const ordersData = await ordersRes.json()
        if (!cancelled) setOrders(ordersData.orders ?? [])

        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json()
          if (!cancelled) setPayments(paymentsData.payments ?? [])
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error cargando leads')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [agentId])

  if (!agentId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
          Sin acceso a leads
        </h2>
        <p className="text-muted-foreground">
          Tu cuenta no tiene un agentId asignado. Contacta al administrador.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Mis Leads
        </h1>
        <p className="text-muted-foreground">
          Clientes que llegaron a traves de tu link de referido.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
            Error al cargar leads
          </h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
            Tu primer cliente te espera
          </h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Comparte tu link de referido en redes sociales, WhatsApp o con tus contactos para empezar a recibir leads.
          </p>
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent-light">
            <Link href="/agent/catalog">
              <Globe className="mr-2 h-4 w-4" />
              Comparte tu link
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-lg border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Contacto</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Viaje</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Monto</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 font-medium">{order.contactName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{order.tripName}</td>
                    <td className="px-4 py-3 text-sm font-mono">{formatCurrency(order.amountTotalCents)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={STATUS_COLORS[order.status] ?? ''}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{order.contactName}</span>
                  <Badge variant="outline" className={STATUS_COLORS[order.status] ?? ''}>
                    {order.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{order.tripName}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono">{formatCurrency(order.amountTotalCents)}</span>
                  <span className="text-muted-foreground">{formatDate(order.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mis Pagos Registrados */}
      {payments.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">Mis Pagos Registrados</h2>
          <div className="space-y-2">
            {payments.map((payment) => (
              <Card key={payment.id} className="p-3">
                <CardContent className="flex items-center gap-3 p-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    {PAYMENT_STATUS_ICONS[payment.status]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(payment.amountCents / 100)}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{payment.tripName ?? 'Sin viaje'}</p>
                    {payment.status === 'rejected' && payment.rejectionNote && (
                      <p className="mt-1 text-xs text-red-600">Motivo: {payment.rejectionNote}</p>
                    )}
                    {payment.status === 'info_requested' && payment.rejectionNote && (
                      <p className="mt-1 text-xs text-blue-600">Solicitud: {payment.rejectionNote}</p>
                    )}
                  </div>
                  <Badge className={PAYMENT_STATUS_COLORS[payment.status]}>
                    {PAYMENT_STATUS_LABELS[payment.status]}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* FAB: Registrar Pago */}
      {orders.length > 0 && (
        <Button
          className="fixed bottom-20 right-4 z-40 h-14 gap-2 rounded-full bg-accent px-6 text-accent-foreground shadow-lg hover:bg-accent/90 md:bottom-6"
          onClick={() => setIsPaymentFormOpen(true)}
        >
          <Plus className="h-5 w-5" />
          <span className="hidden sm:inline">Registrar Pago</span>
        </Button>
      )}

      <PaymentRegistrationForm
        isOpen={isPaymentFormOpen}
        onClose={() => setIsPaymentFormOpen(false)}
        orders={orders.map((o) => ({
          id: o.id,
          tripName: o.tripName,
          amountTotalCents: o.amountTotalCents,
          contactName: o.contactName,
        }))}
      />
    </div>
  )
}
