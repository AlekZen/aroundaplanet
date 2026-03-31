'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Plane, CreditCard, Plus, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Clock, MessageSquare, AlertTriangle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentRegistrationForm } from '@/components/custom/PaymentRegistrationForm'
import {
  PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS,
  type PaymentStatus, type PaymentMethod,
} from '@/schemas/paymentSchema'

interface ClientOrder {
  id: string
  contactName: string
  tripName: string
  status: string
  amountTotalCents: number
  amountPaidCents: number
  createdAt: string | null
}

interface MyPayment {
  id: string
  orderId: string
  tripName: string | null
  amountCents: number
  paymentMethod: PaymentMethod
  bankName: string | null
  bankReference: string | null
  beneficiaryName: string | null
  concept: string | null
  sourceAccount: string | null
  destinationAccount: string | null
  receiptUrl: string | null
  status: PaymentStatus
  rejectionNote: string | null
  createdAt: string | null
  verifiedAt: string | null
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  Interesado: 'bg-blue-100 text-blue-800',
  Confirmado: 'bg-green-100 text-green-800',
  'En Progreso': 'bg-purple-100 text-purple-800',
  Completado: 'bg-emerald-100 text-emerald-800',
  Cancelado: 'bg-red-100 text-red-800',
}

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending_verification: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  info_requested: 'bg-blue-100 text-blue-800',
}

const PAYMENT_STATUS_ICONS: Record<PaymentStatus, React.ReactNode> = {
  pending_verification: <Clock className="h-4 w-4 text-yellow-600" />,
  verified: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  rejected: <XCircle className="h-4 w-4 text-red-600" />,
  info_requested: <MessageSquare className="h-4 w-4 text-blue-600" />,
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface OrderCardProps {
  order: ClientOrder
  payments: MyPayment[]
  onRegisterPayment: (orderId: string) => void
}

function OrderCard({ order, payments, onRegisterPayment }: OrderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const verifiedPayments = payments.filter((p) => p.status === 'verified')
  const pendingPayments = payments.filter((p) => p.status === 'pending_verification')
  const rejectedPayments = payments.filter((p) => p.status === 'rejected')

  const verifiedTotal = verifiedPayments.reduce((sum, p) => sum + p.amountCents, 0)
  const pendingTotal = pendingPayments.reduce((sum, p) => sum + p.amountCents, 0)
  const remaining = Math.max(0, order.amountTotalCents - verifiedTotal)
  const progressPercent = order.amountTotalCents > 0
    ? Math.min(100, Math.round((verifiedTotal / order.amountTotalCents) * 100))
    : 0

  const isActive = order.status !== 'Cancelado' && order.status !== 'Completado'

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-heading text-base font-semibold">{order.tripName}</p>
            <p className="text-sm text-muted-foreground">{order.contactName}</p>
          </div>
          <Badge className={ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800'}>
            {order.status}
          </Badge>
        </div>

        {/* Payment progress */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Progreso de pago</span>
            <span className="text-sm font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="font-mono font-medium text-green-700">{formatCurrency(verifiedTotal)}</p>
              <p className="text-muted-foreground">Verificado</p>
            </div>
            <div>
              <p className="font-mono font-medium text-yellow-700">{formatCurrency(pendingTotal)}</p>
              <p className="text-muted-foreground">En revision</p>
            </div>
            <div>
              <p className="font-mono font-medium text-foreground">{formatCurrency(remaining)}</p>
              <p className="text-muted-foreground">Restante</p>
            </div>
          </div>
        </div>

        {/* Total line */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Total del viaje</span>
          <span className="font-mono font-semibold">{formatCurrency(order.amountTotalCents)}</span>
        </div>

        {/* Alerts */}
        {rejectedPayments.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{rejectedPayments.length} pago{rejectedPayments.length > 1 ? 's' : ''} rechazado{rejectedPayments.length > 1 ? 's' : ''}</p>
              {rejectedPayments[0].rejectionNote && (
                <p className="mt-0.5">Motivo: {rejectedPayments[0].rejectionNote}</p>
              )}
            </div>
          </div>
        )}

        {/* Payment history toggle */}
        {payments.length > 0 && (
          <button
            className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span>{payments.length} pago{payments.length > 1 ? 's' : ''} registrado{payments.length > 1 ? 's' : ''}</span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}

        {/* Expanded payment list */}
        {isExpanded && payments.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-lg bg-muted/30 p-3 text-sm">
                <div className="flex items-center gap-3">
                  {PAYMENT_STATUS_ICONS[payment.status]}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{formatCurrency(payment.amountCents)}</span>
                      <span className="text-xs text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(payment.createdAt)}</p>
                  </div>
                  <Badge className={`text-[10px] ${PAYMENT_STATUS_COLORS[payment.status]}`}>
                    {PAYMENT_STATUS_LABELS[payment.status]}
                  </Badge>
                </div>
                {/* Bank details */}
                {(payment.bankName || payment.bankReference || payment.concept) && (
                  <div className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                    {payment.concept && (
                      <p>Concepto: <strong className="text-foreground">{payment.concept}</strong></p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {payment.bankName && <span>Banco: <strong className="text-foreground">{payment.bankName}</strong></span>}
                      {payment.bankReference && <span>Folio: <strong className="font-mono text-foreground">{payment.bankReference}</strong></span>}
                      {payment.sourceAccount && <span>Origen: <strong className="font-mono text-foreground">•{payment.sourceAccount}</strong></span>}
                      {payment.destinationAccount && <span>Destino: <strong className="font-mono text-foreground">•{payment.destinationAccount}</strong></span>}
                    </div>
                  </div>
                )}
                {payment.status === 'rejected' && payment.rejectionNote && (
                  <p className="mt-1.5 text-xs text-red-600">Motivo: {payment.rejectionNote}</p>
                )}
                {payment.status === 'info_requested' && payment.rejectionNote && (
                  <p className="mt-1.5 text-xs text-blue-600">Solicitud: {payment.rejectionNote}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action button */}
        {isActive && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onRegisterPayment(order.id)}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            {payments.length === 0 ? 'Registrar Primer Pago' : 'Registrar Otro Pago'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function MyTripsContent() {
  const [orders, setOrders] = useState<ClientOrder[]>([])
  const [payments, setPayments] = useState<MyPayment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false)
  const [preselectedOrderId, setPreselectedOrderId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const [ordersRes, paymentsRes] = await Promise.all([
        fetch('/api/my-orders'),
        fetch('/api/my-payments'),
      ])

      if (!ordersRes.ok) {
        const body = await ordersRes.json().catch(() => ({}))
        throw new Error(body.message ?? `Error ${ordersRes.status}`)
      }
      const ordersData = await ordersRes.json()
      setOrders(ordersData.orders ?? [])

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json()
        setPayments(paymentsData.payments ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar tus viajes')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Group payments by orderId
  const paymentsByOrder = payments.reduce<Record<string, MyPayment[]>>((acc, p) => {
    if (!acc[p.orderId]) acc[p.orderId] = []
    acc[p.orderId].push(p)
    return acc
  }, {})

  // Summary stats
  const totalVerified = payments
    .filter((p) => p.status === 'verified')
    .reduce((sum, p) => sum + p.amountCents, 0)
  const totalPending = payments
    .filter((p) => p.status === 'pending_verification')
    .reduce((sum, p) => sum + p.amountCents, 0)
  const totalOrders = orders.reduce((sum, o) => sum + o.amountTotalCents, 0)

  function handleRegisterPayment(orderId: string) {
    setPreselectedOrderId(orderId)
    setIsPaymentFormOpen(true)
  }

  function handleFormClose() {
    setIsPaymentFormOpen(false)
    setPreselectedOrderId(null)
    // Refresh data after registering a payment
    setIsLoading(true)
    fetchData()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Mis Viajes</h1>
        <p className="text-sm text-muted-foreground">Tus cotizaciones, pagos y reservaciones</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50/50 p-6">
          <CardContent className="p-0 text-center">
            <p className="text-sm text-red-800">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setIsLoading(true); fetchData() }}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <Card className="p-8">
          <CardContent className="flex flex-col items-center justify-center p-0 text-center">
            <Plane className="mb-4 h-16 w-16 text-muted-foreground/40" />
            <h2 className="mb-2 font-heading text-xl font-semibold">Tu primera aventura te espera</h2>
            <p className="mb-6 max-w-md text-muted-foreground">
              Explora nuestros destinos y cotiza tu proximo viaje. Una vez que tengas una reservacion, aparecera aqui.
            </p>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link href="/viajes">Explorar Viajes</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Global summary */}
          {orders.length > 0 && (totalVerified > 0 || totalPending > 0) && (
            <Card className="bg-primary/5 p-4">
              <CardContent className="p-0">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="font-mono text-lg font-bold text-green-700">{formatCurrency(totalVerified)}</p>
                    <p className="text-xs text-muted-foreground">Total verificado</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-yellow-700">{formatCurrency(totalPending)}</p>
                    <p className="text-xs text-muted-foreground">En revision</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold">{formatCurrency(Math.max(0, totalOrders - totalVerified))}</p>
                    <p className="text-xs text-muted-foreground">Restante total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order cards */}
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                payments={paymentsByOrder[order.id] ?? []}
                onRegisterPayment={handleRegisterPayment}
              />
            ))}
          </div>

          {/* Persistent CTA to explore more trips */}
          <div className="flex justify-center pt-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/viajes">
                <Plus className="mr-2 h-4 w-4" />
                Explorar mas viajes
              </Link>
            </Button>
          </div>
        </>
      )}

      <PaymentRegistrationForm
        isOpen={isPaymentFormOpen}
        onClose={handleFormClose}
        orders={orders.filter((o) => o.status !== 'Cancelado' && o.status !== 'Completado').map((o) => ({
          id: o.id,
          tripName: o.tripName,
          amountTotalCents: o.amountTotalCents,
          contactName: o.contactName,
        }))}
        preselectedOrderId={preselectedOrderId}
      />
    </div>
  )
}
