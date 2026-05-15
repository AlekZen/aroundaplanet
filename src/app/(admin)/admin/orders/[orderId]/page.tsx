import { notFound } from 'next/navigation'
import { adminDb } from '@/lib/firebase/admin'
import { OrderContractCard } from './OrderContractCard'

export const metadata = {
  title: 'Detalle de orden | AroundaPlanet',
}

interface OrderSummary {
  orderId: string
  contactName: string | null
  contactPhone: string | null
  tripId: string | null
  tripName: string | null
  agentId: string | null
  agentName: string | null
  status: string
  amountTotalCents: number
  amountPaidCents: number
  contractId: string | null
  contractPdfUrl: string | null
  contractVersion: number | null
  contractSharedWithClient: boolean
  contractSharedWithAgent: boolean
  contractAcceptedAt: string | null
  contractAcceptedByName: string | null
  createdAtIso: string | null
}

async function loadOrder(orderId: string): Promise<OrderSummary | null> {
  const snap = await adminDb.collection('orders').doc(orderId).get()
  if (!snap.exists) return null
  const d = snap.data()!

  let tripName: string | null = null
  if (d.tripId) {
    const tripSnap = await adminDb.collection('trips').doc(d.tripId).get()
    if (tripSnap.exists) {
      const td = tripSnap.data()!
      tripName = td.odooName ?? td.name ?? null
    }
  }

  let agentName: string | null = null
  if (d.agentId) {
    const u = await adminDb.collection('users').doc(d.agentId).get()
    if (u.exists) {
      const ud = u.data()!
      const full = `${ud.firstName ?? ''} ${ud.lastName ?? ''}`.trim()
      agentName = ud.displayName ?? (full || null)
    }
    if (!agentName) {
      const oa = await adminDb.collection('odooAgents').doc(d.agentId).get()
      if (oa.exists) agentName = oa.data()?.name ?? null
    }
  }

  // Cargar último contrato si existe para mostrar estado de sharing y aceptación
  let contractSharedWithClient = false
  let contractSharedWithAgent = false
  let contractAcceptedAt: string | null = null
  let contractAcceptedByName: string | null = null
  if (d.contractId) {
    const contractSnap = await adminDb.collection('contracts').doc(d.contractId).get()
    if (contractSnap.exists) {
      const cd = contractSnap.data()!
      contractSharedWithClient = cd.sharedWithClient === true
      contractSharedWithAgent = cd.sharedWithAgent === true
      contractAcceptedAt = cd.acceptedAt?.toDate?.()?.toISOString() ?? null
      contractAcceptedByName = cd.acceptedByName ?? null
    }
  }

  return {
    orderId: snap.id,
    contactName: d.contactName ?? null,
    contactPhone: d.contactPhone ?? null,
    tripId: d.tripId ?? null,
    tripName,
    agentId: d.agentId ?? null,
    agentName,
    status: d.status ?? 'Interesado',
    amountTotalCents: Number(d.amountTotalCents ?? 0),
    amountPaidCents: Number(d.amountPaidCents ?? 0),
    contractId: d.contractId ?? null,
    contractPdfUrl: d.contractPdfUrl ?? null,
    contractVersion: d.contractVersion ?? null,
    contractSharedWithClient,
    contractSharedWithAgent,
    contractAcceptedAt,
    contractAcceptedByName,
    createdAtIso: d.createdAt?.toDate?.()?.toISOString() ?? null,
  }
}

function formatMxn(cents: number): string {
  const pesos = (cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `$${pesos} MXN`
}

export default async function OrderDetailPage(props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params
  const order = await loadOrder(orderId)
  if (!order) notFound()

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Orden #{order.orderId.slice(0, 8)}</h1>
        <p className="text-sm text-muted-foreground">Detalle de la orden y generación de contrato</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Datos generales</h2>
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Cliente</dt>
            <dd className="col-span-2 font-medium">{order.contactName ?? '—'}</dd>

            <dt className="text-muted-foreground">Teléfono</dt>
            <dd className="col-span-2">{order.contactPhone ?? '—'}</dd>

            <dt className="text-muted-foreground">Viaje</dt>
            <dd className="col-span-2">{order.tripName ?? '—'}</dd>

            <dt className="text-muted-foreground">Agente</dt>
            <dd className="col-span-2">{order.agentName ?? '—'}</dd>

            <dt className="text-muted-foreground">Estatus</dt>
            <dd className="col-span-2">{order.status}</dd>

            <dt className="text-muted-foreground">Total</dt>
            <dd className="col-span-2 font-semibold">{formatMxn(order.amountTotalCents)}</dd>

            <dt className="text-muted-foreground">Pagado</dt>
            <dd className="col-span-2">{formatMxn(order.amountPaidCents)}</dd>
          </dl>
        </section>

        <OrderContractCard
          orderId={order.orderId}
          orderTotalCents={order.amountTotalCents}
          existingContractId={order.contractId}
          existingPdfUrl={order.contractPdfUrl}
          existingVersion={order.contractVersion}
          contactName={order.contactName}
          sharedWithClient={order.contractSharedWithClient}
          sharedWithAgent={order.contractSharedWithAgent}
          acceptedAt={order.contractAcceptedAt}
          acceptedByName={order.contractAcceptedByName}
          hasAgent={!!order.agentId}
          hasClientUser={!!order.contactName /* placeholder visible — backend valida userId real */}
        />
      </div>
    </div>
  )
}
