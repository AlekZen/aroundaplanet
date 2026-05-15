import Link from 'next/link'
import { adminDb } from '@/lib/firebase/admin'

export const metadata = {
  title: 'Órdenes | AroundaPlanet',
}

export const dynamic = 'force-dynamic'

interface OrderRow {
  orderId: string
  contactName: string | null
  tripName: string | null
  status: string
  amountTotalCents: number
  amountPaidCents: number
  agentName: string | null
  hasContract: boolean
  createdAtIso: string | null
}

async function loadOrders(limit: number): Promise<OrderRow[]> {
  const snap = await adminDb
    .collection('orders')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()

  // Resolver tripName + agentName en paralelo con cache
  const tripIds = new Set<string>()
  const agentIds = new Set<string>()
  for (const d of snap.docs) {
    const data = d.data()
    if (data.tripId) tripIds.add(data.tripId as string)
    if (data.agentId) agentIds.add(data.agentId as string)
  }

  const [trips, users, odooAgents] = await Promise.all([
    Promise.all(
      [...tripIds].map((id) =>
        adminDb.collection('trips').doc(id).get().then((s) => ({ id, data: s.exists ? s.data() : null }))
      )
    ),
    Promise.all(
      [...agentIds].map((id) =>
        adminDb.collection('users').doc(id).get().then((s) => ({ id, data: s.exists ? s.data() : null }))
      )
    ),
    Promise.all(
      [...agentIds].map((id) =>
        adminDb.collection('odooAgents').doc(id).get().then((s) => ({ id, data: s.exists ? s.data() : null }))
      )
    ),
  ])

  const tripMap = new Map(trips.map((t) => [t.id, t.data?.odooName ?? t.data?.name ?? null]))
  const agentMap = new Map<string, string | null>()
  for (const u of users) {
    if (!u.data) continue
    const full = `${u.data.firstName ?? ''} ${u.data.lastName ?? ''}`.trim()
    agentMap.set(u.id, u.data.displayName ?? (full || null))
  }
  for (const o of odooAgents) {
    if (!agentMap.get(o.id) && o.data) {
      agentMap.set(o.id, o.data.name ?? null)
    }
  }

  return snap.docs.map((d) => {
    const data = d.data()
    return {
      orderId: d.id,
      contactName: data.contactName ?? null,
      tripName: data.tripId ? tripMap.get(data.tripId as string) ?? null : null,
      status: data.status ?? 'Interesado',
      amountTotalCents: Number(data.amountTotalCents ?? 0),
      amountPaidCents: Number(data.amountPaidCents ?? 0),
      agentName: data.agentId ? agentMap.get(data.agentId as string) ?? null : null,
      hasContract: !!data.contractId,
      createdAtIso: data.createdAt?.toDate?.()?.toISOString() ?? null,
    }
  })
}

function formatMxn(cents: number): string {
  const pesos = (cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `$${pesos}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export default async function AdminOrdersPage() {
  const orders = await loadOrders(100)

  return (
    <div className="space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Órdenes</h1>
        <p className="text-sm text-muted-foreground">
          Últimas 100 órdenes ordenadas por fecha. Click en cualquier fila para abrir el detalle y
          generar contrato.
        </p>
      </header>

      {orders.length === 0 ? (
        <div className="rounded border-l-4 border-blue-500 bg-blue-50 p-4 text-sm">
          No hay órdenes registradas todavía.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Viaje</th>
                <th className="px-3 py-2 font-medium">Agente</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
                <th className="px-3 py-2 font-medium text-right">Pagado</th>
                <th className="px-3 py-2 font-medium">Contrato</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderId} className="border-t border-border align-top hover:bg-muted/30">
                  <td className="px-3 py-2">{o.contactName ?? '—'}</td>
                  <td className="px-3 py-2">{o.tripName ?? '—'}</td>
                  <td className="px-3 py-2">{o.agentName ?? '—'}</td>
                  <td className="px-3 py-2">{o.status}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatMxn(o.amountTotalCents)}
                  </td>
                  <td className="px-3 py-2 text-right">{formatMxn(o.amountPaidCents)}</td>
                  <td className="px-3 py-2">
                    {o.hasContract ? <span className="text-green-700">✓ Generado</span> : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(o.createdAtIso)}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/orders/${o.orderId}`}
                      className="text-primary hover:underline"
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
