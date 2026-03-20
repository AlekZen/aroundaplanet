'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plane, CreditCard, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentRegistrationForm } from '@/components/custom/PaymentRegistrationForm'

interface ClientOrder {
  id: string
  contactName: string
  tripName: string
  status: string
  amountTotalCents: number
  amountPaidCents: number
  createdAt: string | null
}

const STATUS_COLORS: Record<string, string> = {
  Interesado: 'bg-blue-100 text-blue-800',
  Confirmado: 'bg-green-100 text-green-800',
  'En Progreso': 'bg-purple-100 text-purple-800',
  Completado: 'bg-emerald-100 text-emerald-800',
  Cancelado: 'bg-red-100 text-red-800',
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

export function MyTripsContent() {
  const [orders, setOrders] = useState<ClientOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false)
  const [preselectedOrderId, setPreselectedOrderId] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/my-orders')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `Error ${res.status}`)
      }
      const data = await res.json()
      setOrders(data.orders ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar tus viajes')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  function handleRegisterPayment(orderId: string) {
    setPreselectedOrderId(orderId)
    setIsPaymentFormOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Mis Viajes</h1>
        <p className="text-sm text-muted-foreground">Tus cotizaciones y reservaciones</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50/50 p-6">
          <CardContent className="p-0 text-center">
            <p className="text-sm text-red-800">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setIsLoading(true); fetchOrders() }}>
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
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="p-4">
              <CardContent className="space-y-3 p-0">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{order.tripName}</p>
                    <p className="text-sm text-muted-foreground">{order.contactName}</p>
                  </div>
                  <Badge className={STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800'}>
                    {order.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-mono font-medium">{formatCurrency(order.amountTotalCents)}</span>
                    {order.amountPaidCents > 0 && (
                      <span className="ml-2 text-green-600">
                        Pagado: {formatCurrency(order.amountPaidCents)}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground">{formatDate(order.createdAt)}</span>
                </div>
                {order.status !== 'Cancelado' && order.status !== 'Completado' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleRegisterPayment(order.id)}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Subir Comprobante de Pago
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PaymentRegistrationForm
        isOpen={isPaymentFormOpen}
        onClose={() => { setIsPaymentFormOpen(false); setPreselectedOrderId(null) }}
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
