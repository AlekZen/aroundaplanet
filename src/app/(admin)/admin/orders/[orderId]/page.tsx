import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminDb } from '@/lib/firebase/admin'
import { OrderContractCard } from './OrderContractCard'
import { PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, type PaymentStatus, type PaymentMethod } from '@/schemas/paymentSchema'

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

interface PaymentRow {
  paymentId: string
  amountCents: number
  paymentMethod: PaymentMethod
  status: PaymentStatus
  dateIso: string | null
  createdAtIso: string | null
  registeredByName: string | null
  bankReference: string | null
  receiptUrl: string | null
  syncedToOdoo: boolean
  odooPaymentId: number | null
  odooState: string | null
  odooJournalName: string | null
}

async function loadPayments(orderId: string): Promise<PaymentRow[]> {
  const snap = await adminDb
    .collection('payments')
    .where('orderId', '==', orderId)
    .get()
  const rows: PaymentRow[] = snap.docs.map((d) => {
    const data = d.data()
    return {
      paymentId: d.id,
      amountCents: Number(data.amountCents ?? 0),
      paymentMethod: (data.paymentMethod ?? 'transfer') as PaymentMethod,
      status: (data.status ?? 'pending_verification') as PaymentStatus,
      dateIso: data.date?.toDate?.()?.toISOString() ?? null,
      createdAtIso: data.createdAt?.toDate?.()?.toISOString() ?? null,
      registeredByName: data.registeredByName ?? null,
      bankReference: data.bankReference ?? null,
      receiptUrl: data.receiptUrl ?? null,
      syncedToOdoo: data.syncedToOdoo === true || !!data.odooPaymentId,
      odooPaymentId: data.odooPaymentId ?? null,
      odooState: data.odooState ?? null,
      odooJournalName: data.odooJournalName ?? null,
    }
  })
  rows.sort((a, b) => (b.createdAtIso ?? '').localeCompare(a.createdAtIso ?? ''))
  return rows
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

const STATUS_TONE: Record<PaymentStatus, string> = {
  pending_verification: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  info_requested: 'bg-blue-100 text-blue-800',
}

export default async function OrderDetailPage(props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params
  const [order, payments] = await Promise.all([loadOrder(orderId), loadPayments(orderId)])
  if (!order) notFound()

  const saldoCents = Math.max(order.amountTotalCents - order.amountPaidCents, 0)
  const hasVerifiedPayment = payments.some((p) => p.status === 'verified')
  const isFullyPaid = order.amountTotalCents > 0 && order.amountPaidCents >= order.amountTotalCents

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {order.orderId.startsWith('odoo-sale-')
            ? `Orden Odoo S${order.orderId.replace('odoo-sale-', '')}`
            : `Orden #${order.orderId.slice(0, 8)}`}
        </h1>
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
            <dd className="col-span-2">
              {formatMxn(order.amountPaidCents)}
              {order.amountTotalCents > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({Math.round((order.amountPaidCents / order.amountTotalCents) * 100)}%)
                </span>
              )}
            </dd>

            <dt className="text-muted-foreground">Saldo</dt>
            <dd className="col-span-2 font-semibold">
              {formatMxn(saldoCents)}
              {isFullyPaid && <span className="ml-2 text-green-700 text-xs">✓ Pagado completo</span>}
            </dd>
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

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-foreground">Pagos de esta orden</h2>
          <div className="flex flex-wrap gap-3 text-xs">
            <Link
              href={`/admin/verification?orderId=${order.orderId}`}
              className="text-primary hover:underline"
            >
              Abrir en verificación →
            </Link>
            {hasVerifiedPayment && !order.contractId && (
              <span className="rounded bg-yellow-100 text-yellow-900 px-2 py-0.5">
                ⚠ Ya hay pago verificado, contrato no se ha generado todavía
              </span>
            )}
          </div>
        </header>

        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay pagos registrados todavía. El agente o cliente debe registrar el primer pago
            desde el portal.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Fecha</th>
                  <th className="px-2 py-1.5 font-medium text-right">Monto</th>
                  <th className="px-2 py-1.5 font-medium">Método</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 font-medium">Sync Odoo</th>
                  <th className="px-2 py-1.5 font-medium">Comprobante</th>
                  <th className="px-2 py-1.5 font-medium">Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.paymentId} className="border-t border-border align-top">
                    <td className="px-2 py-1.5 text-xs">{formatDate(p.dateIso ?? p.createdAtIso)}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{formatMxn(p.amountCents)}</td>
                    <td className="px-2 py-1.5">{PAYMENT_METHOD_LABELS[p.paymentMethod]}</td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_TONE[p.status]}`}>
                        {PAYMENT_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      {p.odooPaymentId
                        ? `#${p.odooPaymentId} · ${p.odooJournalName ?? p.odooState ?? '—'}`
                        : p.syncedToOdoo
                          ? 'Sincronizando…'
                          : p.status === 'verified'
                            ? <span className="text-yellow-700">⏳ Pendiente push</span>
                            : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      {p.receiptUrl ? (
                        <a
                          href={p.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs"
                        >
                          Ver
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-xs">{p.registeredByName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
