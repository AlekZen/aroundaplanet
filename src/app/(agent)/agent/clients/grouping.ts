import type { UnifiedClient, UnifiedOrder } from '@/schemas/contactSchema'

export interface TripGroup {
  tripId: string | null
  tripName: string
  clients: {
    client: UnifiedClient
    orders: UnifiedOrder[]
  }[]
  totalAmount: number
}

export interface ClientGroup {
  client: UnifiedClient
  trips: {
    tripId: string | null
    tripName: string
    orders: UnifiedOrder[]
  }[]
  totalAmount: number
}

/**
 * Agrupa clientes por viaje. Un cliente aparece en múltiples grupos si tiene
 * órdenes en múltiples viajes. Órdenes sin tripId van a "Sin viaje asociado".
 */
export function groupByTrip(
  clients: UnifiedClient[],
  tripMap: Record<string, string>
): TripGroup[] {
  const groupMap = new Map<string | null, TripGroup>()

  for (const client of clients) {
    // Agrupar las órdenes de este cliente por tripId
    const ordersByTrip = new Map<string | null, UnifiedOrder[]>()
    for (const order of client.orders) {
      const key = order.tripId ?? null
      const arr = ordersByTrip.get(key)
      if (arr) {
        arr.push(order)
      } else {
        ordersByTrip.set(key, [order])
      }
    }

    // Si el cliente no tiene órdenes, va al grupo null
    if (ordersByTrip.size === 0) {
      ordersByTrip.set(null, [])
    }

    for (const [tripId, orders] of ordersByTrip) {
      let group = groupMap.get(tripId)
      if (!group) {
        group = {
          tripId,
          tripName: tripId ? (tripMap[tripId] ?? tripId) : 'Sin viaje asociado',
          clients: [],
          totalAmount: 0,
        }
        groupMap.set(tripId, group)
      }
      group.clients.push({ client, orders })
      group.totalAmount += orders.reduce((sum, o) => sum + o.amountTotal, 0)
    }
  }

  const groups = Array.from(groupMap.values())

  // Ordenar: viajes con nombre alfabético, "Sin viaje" al final
  groups.sort((a, b) => {
    if (a.tripId === null) return 1
    if (b.tripId === null) return -1
    return a.tripName.localeCompare(b.tripName, 'es-MX')
  })

  return groups
}

/**
 * Agrupa por cliente. Dentro de cada cliente, las órdenes se sub-agrupan por viaje.
 */
export function groupByClient(
  clients: UnifiedClient[],
  tripMap: Record<string, string>
): ClientGroup[] {
  const groups: ClientGroup[] = clients.map((client) => {
    const tripGroupMap = new Map<string | null, UnifiedOrder[]>()

    for (const order of client.orders) {
      const key = order.tripId ?? null
      const arr = tripGroupMap.get(key)
      if (arr) {
        arr.push(order)
      } else {
        tripGroupMap.set(key, [order])
      }
    }

    const trips = Array.from(tripGroupMap.entries()).map(([tripId, orders]) => ({
      tripId,
      tripName: tripId ? (tripMap[tripId] ?? tripId) : 'Sin viaje asociado',
      orders,
    }))

    // Ordenar sub-grupos: viajes con nombre primero, "Sin viaje" al final
    trips.sort((a, b) => {
      if (a.tripId === null) return 1
      if (b.tripId === null) return -1
      return a.tripName.localeCompare(b.tripName, 'es-MX')
    })

    return {
      client,
      trips,
      totalAmount: client.orders.reduce((sum, o) => sum + o.amountTotal, 0),
    }
  })

  // Ordenar clientes por nombre
  groups.sort((a, b) => a.client.name.localeCompare(b.client.name, 'es-MX'))

  return groups
}
