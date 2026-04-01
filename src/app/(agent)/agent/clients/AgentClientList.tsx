'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
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
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Search, Users, RefreshCw, Phone, Mail, MapPin,
  ShoppingBag, CreditCard, Plus, AlertTriangle,
  Loader2, Plane,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PaymentRegistrationForm } from '@/components/custom/PaymentRegistrationForm'
import type { AgentClientsResponse, AgentClientOrder } from '@/app/api/agents/[agentId]/clients/route'
import type { UnifiedClient, UnifiedOrder } from '@/schemas/contactSchema'
import { groupByTrip, groupByClient } from './grouping'
import { GroupedByTripView } from './GroupedByTripView'
import { GroupedByClientView } from './GroupedByClientView'

import {
  formatMXN, formatDate,
  PAYMENT_STATE_LABELS, PAYMENT_STATE_COLORS,
} from './client-utils'

// ── Types ──

interface AgentClientListProps {
  agentId: string
  title?: string
  hideHeader?: boolean
}

type PublishedTrip = {
  id: string
  odooName: string
  odooListPriceCentavos: number
  odooCurrencyCode: string
}

// ── CreateContactSheet ──

function CreateContactSheet({
  isOpen,
  onClose,
  agentId,
  onCreated,
  trips,
}: {
  isOpen: boolean
  onClose: () => void
  agentId: string
  onCreated: () => void
  trips: PublishedTrip[]
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [mobile, setMobile] = useState('')
  const [city, setCity] = useState('')
  const [selectedTripId, setSelectedTripId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setName('')
    setEmail('')
    setPhone('')
    setMobile('')
    setCity('')
    setSelectedTripId('')
    setError(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/agent-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          mobile: mobile.trim() || undefined,
          city: city.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error((errData as { message?: string }).message ?? `Error ${res.status}`)
      }

      const created = await res.json() as { contactId?: string }

      // (F6) Si hay viaje seleccionado, inscribir automáticamente
      if (selectedTripId && selectedTripId !== 'none' && created.contactId) {
        try {
          const enrollRes = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tripId: selectedTripId,
              contactName: name.trim(),
              agentId,
              agentContactId: created.contactId,
            }),
          })

          if (!enrollRes.ok) {
            // Contacto creado pero inscripción falló
            handleClose()
            onCreated()
            toast.error('Contacto creado pero la inscripcion al viaje fallo. Puedes inscribirlo desde el detalle del cliente.')
            return
          }
        } catch {
          // Contacto creado pero inscripción falló por error de red
          handleClose()
          onCreated()
          toast.error('Contacto creado pero la inscripcion al viaje fallo. Puedes inscribirlo desde el detalle del cliente.')
          return
        }
      }

      toast.success(selectedTripId && selectedTripId !== 'none' ? 'Cliente creado e inscrito al viaje' : 'Cliente creado exitosamente')
      handleClose()
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear contacto')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      <div>
        <label className="text-sm font-medium" htmlFor="contact-name">Nombre *</label>
        <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" required />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="contact-email">Email</label>
        <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium" htmlFor="contact-phone">Telefono</label>
          <Input id="contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+52..." />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="contact-mobile">Celular</label>
          <Input id="contact-mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+52..." />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="contact-city">Ciudad</label>
        <Input id="contact-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Guadalajara" />
      </div>
      {/* (F14) Selector de viaje opcional */}
      <div>
        <label className="text-sm font-medium">Viaje (opcional)</label>
        <Select value={selectedTripId} onValueChange={setSelectedTripId}>
          <SelectTrigger>
            <SelectValue placeholder={trips.length === 0 ? 'Cargando viajes...' : 'Sin viaje'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin viaje</SelectItem>
            {trips.map((trip) => (
              <SelectItem key={trip.id} value={trip.id}>
                {trip.odooName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando...</> : 'Crear Cliente'}
      </Button>
    </form>
  )

  return (
    <>
      <div className="lg:hidden">
        <Sheet open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Nuevo Cliente</SheetTitle>
              <SheetDescription>Crea un contacto nuevo en tu cartera</SheetDescription>
            </SheetHeader>
            {formContent}
          </SheetContent>
        </Sheet>
      </div>
      <div className="hidden lg:block">
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
          <DialogContent className="max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Nuevo Cliente</DialogTitle>
              <DialogDescription>Crea un contacto nuevo en tu cartera</DialogDescription>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}

// ── EnrollInTripSheet ──

function EnrollInTripSheet({
  isOpen,
  onClose,
  contact,
  agentId,
  onEnrolled,
}: {
  isOpen: boolean
  onClose: () => void
  contact: { name: string; phone: string | null; contactId: string }
  agentId: string
  onEnrolled: () => void
}) {
  const [trips, setTrips] = useState<PublishedTrip[]>([])
  const [isLoadingTrips, setIsLoadingTrips] = useState(true)
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setIsLoadingTrips(true)
    setSelectedTripId(null)
    setError(null)

    fetch('/api/trips/published')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`Error ${r.status}`)))
      .then((data) => setTrips(data.trips ?? []))
      .catch(() => setError('No se pudieron cargar los viajes'))
      .finally(() => setIsLoadingTrips(false))
  }, [isOpen])

  async function handleEnroll() {
    if (!selectedTripId) return
    setIsEnrolling(true)
    setError(null)

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: selectedTripId,
          contactName: contact.name,
          contactPhone: contact.phone ?? undefined,
          agentId, // claims.uid — F3
          agentContactId: contact.contactId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? `Error ${res.status}`)
      }

      toast.success('Cliente inscrito al viaje')
      onClose()
      onEnrolled()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al inscribir')
    } finally {
      setIsEnrolling(false)
    }
  }

  const content = (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        Inscribir a <span className="font-medium text-foreground">{contact.name}</span> en un viaje
      </p>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {isLoadingTrips ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No hay viajes publicados</p>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {trips.map((trip) => (
            <button
              type="button"
              key={trip.id}
              onClick={() => setSelectedTripId(trip.id)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                selectedTripId === trip.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'hover:bg-muted/50'
              }`}
            >
              <p className="font-medium text-sm">{trip.odooName}</p>
              <p className="text-sm font-mono text-muted-foreground mt-0.5">
                {formatMXN(trip.odooListPriceCentavos / 100)} {trip.odooCurrencyCode}
              </p>
            </button>
          ))}
        </div>
      )}

      <Button
        className="w-full"
        disabled={!selectedTripId || isEnrolling}
        onClick={handleEnroll}
      >
        {isEnrolling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Inscribiendo...</> : 'Inscribir a Viaje'}
      </Button>
    </div>
  )

  return (
    <>
      <div className="lg:hidden">
        <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Inscribir a Viaje</SheetTitle>
              <SheetDescription>Selecciona un viaje para inscribir al cliente</SheetDescription>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
      </div>
      <div className="hidden lg:block">
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
          <DialogContent className="max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Inscribir a Viaje</DialogTitle>
              <DialogDescription>Selecciona un viaje para inscribir al cliente</DialogDescription>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}

// ── ClientDetailSheet (enhanced with actions) ──

function ClientDetailSheet({
  client,
  agentId,
  onClose,
  onRefresh,
}: {
  client: UnifiedClient | null
  agentId: string
  onClose: () => void
  onRefresh: () => void
}) {
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null)

  if (!client) return null

  const isPlatform = client.source === 'platform'

  const paymentOrders = isPlatform
    ? client.orders
        .filter((o) => o.source === 'platform')
        .map((o) => ({
          id: o.orderId,
          tripName: o.orderName,
          amountTotalCents: o.amountTotalCents ?? 0,
          contactName: client.name,
        }))
    : []

  return (
    <>
      <Sheet open={!!client} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left flex items-center gap-2">
              {client.name}
              <Badge variant={isPlatform ? 'default' : 'secondary'} className={isPlatform ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                {isPlatform ? 'Plataforma' : 'Odoo'}
              </Badge>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Contact info */}
            <div className="space-y-2">
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <Mail className="h-4 w-4" /> {client.email}
                </a>
              )}
              {client.phone && (
                <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <Phone className="h-4 w-4" /> {client.phone}
                </a>
              )}
              {client.city && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {client.city}
                </p>
              )}
            </div>

            {/* Action: Inscribir a viaje (solo plataforma) */}
            {isPlatform && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setEnrollOpen(true)}
              >
                <Plane className="h-4 w-4 mr-2" /> Inscribir a Viaje
              </Button>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="pt-3 pb-2 px-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <ShoppingBag className="h-3.5 w-3.5" /> Total vendido
                  </div>
                  <p className="text-lg font-bold font-mono">{formatMXN(client.totalAmount)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 pb-2 px-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <CreditCard className="h-3.5 w-3.5" /> Ordenes
                  </div>
                  <p className="text-lg font-bold">{client.orderCount}</p>
                </CardContent>
              </Card>
            </div>

            {/* Orders list */}
            <div className="space-y-3">
              <h3 className="font-heading text-sm font-semibold text-foreground">
                Ordenes ({client.orders.length})
              </h3>
              {client.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Sin ordenes registradas</p>
              ) : (
                <div className="space-y-2">
                  {client.orders.map((order) => (
                    <OrderCard
                      key={`${order.source}-${order.orderId}`}
                      order={order}
                      showPaymentButton={isPlatform && order.source === 'platform'}
                      onPayment={() => {
                        setPaymentOrderId(order.orderId)
                        setPaymentOpen(true)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Enroll modal */}
      {isPlatform && (
        <EnrollInTripSheet
          isOpen={enrollOpen}
          onClose={() => setEnrollOpen(false)}
          contact={{ name: client.name, phone: client.phone, contactId: client.id }}
          agentId={agentId}
          onEnrolled={() => {
            setEnrollOpen(false)
            onRefresh()
          }}
        />
      )}

      {/* Payment modal */}
      <PaymentRegistrationForm
        isOpen={paymentOpen}
        onClose={() => {
          setPaymentOpen(false)
          setPaymentOrderId(null)
          onRefresh()
        }}
        orders={paymentOrders}
        preselectedOrderId={paymentOrderId}
      />
    </>
  )
}

// ── OrderCard ──

function OrderCard({
  order,
  showPaymentButton,
  onPayment,
}: {
  order: UnifiedOrder
  showPaymentButton: boolean
  onPayment: () => void
}) {
  const isOdoo = order.source === 'odoo'

  return (
    <Card className="p-3">
      <CardContent className="p-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{order.orderName}</span>
          {isOdoo && order.paymentState && (
            <Badge className={`text-xs ${PAYMENT_STATE_COLORS[order.paymentState] ?? ''}`}>
              {PAYMENT_STATE_LABELS[order.paymentState] ?? order.paymentState}
            </Badge>
          )}
          {!isOdoo && order.status && (
            <Badge variant="outline" className="text-xs">{order.status}</Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono">{formatMXN(order.amountTotal)}</span>
          <span className="text-xs text-muted-foreground">{formatDate(order.dateOrder)}</span>
        </div>
        {isOdoo && (order.amountResidual ?? 0) > 0 && (
          <p className="text-xs text-orange-600">Pendiente: {formatMXN(order.amountResidual!)}</p>
        )}
        {!isOdoo && order.amountTotalCents != null && order.amountPaidCents != null && order.amountTotalCents > order.amountPaidCents && (
          <p className="text-xs text-orange-600">
            Pagado: {formatMXN(order.amountPaidCents / 100)} de {formatMXN(order.amountTotalCents / 100)}
          </p>
        )}
        {showPaymentButton && (
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={onPayment}>
            <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Registrar Pago
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Component ──

export function AgentClientList({ agentId, title, hideHeader }: AgentClientListProps) {
  const [unifiedClients, setUnifiedClients] = useState<UnifiedClient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [platformWarning, setPlatformWarning] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<UnifiedClient | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [groupMode, setGroupMode] = useState<'trip' | 'client'>('trip')
  const [trips, setTrips] = useState<PublishedTrip[]>([])

  // Summary stats from Odoo (kept for display)
  const [odooSummary, setOdooSummary] = useState<AgentClientsResponse['summary'] | null>(null)

  // Fetch trips on mount (F3: fallback — if fails, tripMap stays empty)
  useEffect(() => {
    fetch('/api/trips/published')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`Error ${r.status}`)))
      .then((data) => setTrips(data.trips ?? []))
      .catch(() => { /* tripMap queda vacío — headers mostrarán tripId como fallback */ })
  }, [])

  const tripMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const t of trips) {
      map[t.id] = t.odooName
    }
    return map
  }, [trips])

  const fetchClients = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setPlatformWarning(null)

    // Fetch Odoo clients and platform contacts in parallel
    const [odooResult, platformResult] = await Promise.allSettled([
      fetch(`/api/agents/${agentId}/clients`).then((r) => {
        if (!r.ok) throw new Error(`Error Odoo ${r.status}`)
        return r.json() as Promise<AgentClientsResponse>
      }),
      fetch('/api/agent-contacts').then(async (r) => {
        if (!r.ok) throw new Error(`Error plataforma ${r.status}`)
        return r.json() as Promise<{ contacts: Array<{ id: string; name: string; email: string | null; phone: string | null; mobile: string | null; city: string | null; source: string }> }>
      }),
    ])

    // Process Odoo clients → UnifiedClient[]
    const odooClients: UnifiedClient[] = []
    if (odooResult.status === 'fulfilled') {
      setOdooSummary(odooResult.value.summary)
      for (const c of odooResult.value.clients) {
        odooClients.push({
          id: String(c.partnerId),
          name: c.name,
          email: c.email ?? null,
          phone: c.phone ?? null,
          city: c.city ?? null,
          source: 'odoo',
          orderCount: c.orderCount,
          totalAmount: c.totalAmount,
          orders: c.orders.map((o: AgentClientOrder) => ({
            orderId: String(o.orderId),
            orderName: o.orderName,
            amountTotal: o.amountTotal,
            dateOrder: o.dateOrder,
            source: 'odoo' as const,
            paymentState: o.paymentState,
            amountResidual: o.amountResidual,
          })),
        })
      }
    } else {
      setError('Error al cargar clientes de Odoo')
      setIsLoading(false)
      return
    }

    // Process platform contacts → UnifiedClient[]
    const platformClients: UnifiedClient[] = []
    if (platformResult.status === 'fulfilled') {
      const contacts = platformResult.value.contacts

      // Fetch orders for each platform contact in parallel
      const detailResults = await Promise.allSettled(
        contacts.map((c) =>
          fetch(`/api/agent-contacts/${c.id}`)
            .then((r) => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
        )
      )

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i]
        const detailResult = detailResults[i]

        let orders: UnifiedOrder[] = []
        let totalAmount = 0

        if (detailResult.status === 'fulfilled') {
          const detail = detailResult.value as { orders: Array<{ orderId: string; orderName: string; tripId?: string; amountTotalCents: number; amountPaidCents: number; createdAt: string | null; status: string }> }
          orders = detail.orders.map((o) => ({
            orderId: o.orderId,
            orderName: o.orderName,
            tripId: o.tripId,
            amountTotal: o.amountTotalCents / 100,
            dateOrder: o.createdAt,
            source: 'platform' as const,
            status: o.status,
            amountPaidCents: o.amountPaidCents,
            amountTotalCents: o.amountTotalCents,
          }))
          totalAmount = orders.reduce((sum, o) => sum + o.amountTotal, 0)
        }

        platformClients.push({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone ?? contact.mobile ?? null,
          city: contact.city,
          source: 'platform',
          orderCount: orders.length,
          totalAmount,
          orders,
        })
      }
    } else {
      setPlatformWarning('No se pudieron cargar los contactos de la plataforma. Solo se muestran clientes de Odoo.')
    }

    // Merge and sort by name (F14)
    const merged = [...odooClients, ...platformClients].sort((a, b) =>
      a.name.localeCompare(b.name, 'es-MX')
    )

    setUnifiedClients(merged)
    setIsLoading(false)
  }, [agentId])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // (F8) Búsqueda extendida: en modo trip, también filtra por nombre de viaje
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return unifiedClients
    return unifiedClients.filter((c) => {
      if (
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q)
      ) return true
      // En modo trip, también buscar por nombre de viaje
      if (groupMode === 'trip') {
        return c.orders.some((o) => {
          if (!o.tripId) return false
          const tripName = tripMap[o.tripId]
          return tripName?.toLowerCase().includes(q)
        })
      }
      return false
    })
  }, [unifiedClients, search, groupMode, tripMap])

  const tripGroups = useMemo(() => groupByTrip(filtered, tripMap), [filtered, tripMap])
  const clientGroups = useMemo(() => groupByClient(filtered, tripMap), [filtered, tripMap])

  const totalClients = unifiedClients.length
  const totalOrders = unifiedClients.reduce((sum, c) => sum + c.orderCount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
            {title ?? 'Mis Clientes'}
          </h1>
          <p className="text-muted-foreground">
            Clientes de Odoo y contactos de la plataforma.
          </p>
        </div>
      )}

      {/* Platform warning banner (F12) */}
      {platformWarning && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3">
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <p className="text-sm text-yellow-800">{platformWarning}</p>
        </div>
      )}

      {/* Summary cards */}
      {!isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Clientes</p>
              <p className="text-2xl font-bold">{totalClients}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Ordenes</p>
              <p className="text-2xl font-bold text-blue-700">{totalOrders}</p>
            </CardContent>
          </Card>
          {odooSummary && (
            <>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs text-muted-foreground">Total vendido</p>
                  <p className="text-lg font-bold text-green-700 font-mono">{formatMXN(odooSummary.totalAmount)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs text-muted-foreground">Por cobrar</p>
                  <p className="text-lg font-bold text-orange-700 font-mono">{formatMXN(odooSummary.totalResidual)}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Group toggle + Search + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={groupMode} onValueChange={(v) => { setGroupMode(v as 'trip' | 'client'); setSearch('') }}>
          <TabsList>
            <TabsTrigger value="trip">Por Viaje</TabsTrigger>
            <TabsTrigger value="client">Por Cliente</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3 flex-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={groupMode === 'trip' ? 'Buscar por nombre, email, ciudad o viaje...' : 'Buscar por nombre, email o ciudad...'}
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
        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Nuevo Cliente</span>
        </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        /* (F11) Skeleton genérico — 3 rectángulos, NO Accordion falsos */
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
        /* (F7) Empty state */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
            {search ? 'Sin resultados' : 'Sin clientes'}
          </h2>
          <p className="text-muted-foreground max-w-md">
            {search
              ? 'No se encontraron clientes con ese filtro'
              : 'Aun no tienes clientes. Crea uno con el boton "Nuevo Cliente".'
            }
          </p>
        </div>
      ) : groupMode === 'trip' ? (
        <GroupedByTripView
          tripGroups={tripGroups}
          onClientClick={setSelectedClient}
        />
      ) : (
        <GroupedByClientView
          clientGroups={clientGroups}
          onClientClick={setSelectedClient}
        />
      )}

      {/* Client detail sheet */}
      <ClientDetailSheet
        client={selectedClient}
        agentId={agentId}
        onClose={() => setSelectedClient(null)}
        onRefresh={() => {
          setSelectedClient(null)
          fetchClients()
        }}
      />

      {/* Create contact modal */}
      <CreateContactSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        agentId={agentId}
        onCreated={fetchClients}
        trips={trips}
      />
    </div>
  )
}
