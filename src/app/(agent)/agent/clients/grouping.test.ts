import { describe, it, expect } from 'vitest'
import { groupByTrip, groupByClient } from './grouping'
import type { UnifiedClient } from '@/schemas/contactSchema'

const tripMap: Record<string, string> = {
  trip1: 'Vuelta al Mundo 33.8 dias',
  trip2: 'Europa Express 15 dias',
}

function makeClient(overrides: Partial<UnifiedClient> & { id: string; name: string }): UnifiedClient {
  return {
    email: null,
    phone: null,
    city: null,
    source: 'platform',
    orderCount: 0,
    totalAmount: 0,
    orders: [],
    ...overrides,
  }
}

describe('groupByTrip', () => {
  it('agrupa cliente con 1 orden platform bajo el viaje correcto', () => {
    const clients = [
      makeClient({
        id: 'c1',
        name: 'Ana Lopez',
        orders: [
          { orderId: 'o1', orderName: 'Vuelta al Mundo', tripId: 'trip1', amountTotal: 145000, dateOrder: null, source: 'platform' },
        ],
      }),
    ]

    const groups = groupByTrip(clients, tripMap)
    expect(groups).toHaveLength(1)
    expect(groups[0].tripId).toBe('trip1')
    expect(groups[0].tripName).toBe('Vuelta al Mundo 33.8 dias')
    expect(groups[0].clients).toHaveLength(1)
    expect(groups[0].clients[0].client.name).toBe('Ana Lopez')
  })

  it('cliente con ordenes en 2 viajes distintos aparece en ambos grupos', () => {
    const clients = [
      makeClient({
        id: 'c1',
        name: 'Carlos Ruiz',
        orders: [
          { orderId: 'o1', orderName: 'Vuelta', tripId: 'trip1', amountTotal: 145000, dateOrder: null, source: 'platform' },
          { orderId: 'o2', orderName: 'Europa', tripId: 'trip2', amountTotal: 80000, dateOrder: null, source: 'platform' },
        ],
      }),
    ]

    const groups = groupByTrip(clients, tripMap)
    expect(groups).toHaveLength(2)
    const trip1Group = groups.find((g) => g.tripId === 'trip1')!
    const trip2Group = groups.find((g) => g.tripId === 'trip2')!
    expect(trip1Group.clients[0].client.name).toBe('Carlos Ruiz')
    expect(trip2Group.clients[0].client.name).toBe('Carlos Ruiz')
  })

  it('(F4) cliente con 2 ordenes del MISMO viaje — ambas en orders[] del mismo entry', () => {
    const clients = [
      makeClient({
        id: 'c1',
        name: 'Maria Garcia',
        orders: [
          { orderId: 'o1', orderName: 'Vuelta', tripId: 'trip1', amountTotal: 72500, dateOrder: null, source: 'platform' },
          { orderId: 'o2', orderName: 'Vuelta 2do pago', tripId: 'trip1', amountTotal: 72500, dateOrder: null, source: 'platform' },
        ],
      }),
    ]

    const groups = groupByTrip(clients, tripMap)
    expect(groups).toHaveLength(1)
    expect(groups[0].clients).toHaveLength(1)
    expect(groups[0].clients[0].orders).toHaveLength(2)
  })

  it('cliente Odoo sin tripId aparece en "Sin viaje asociado"', () => {
    const clients = [
      makeClient({
        id: 'c1',
        name: 'Pedro Sanchez',
        source: 'odoo',
        orders: [
          { orderId: 'o1', orderName: 'S00123', amountTotal: 145000, dateOrder: null, source: 'odoo' },
        ],
      }),
    ]

    const groups = groupByTrip(clients, tripMap)
    expect(groups).toHaveLength(1)
    expect(groups[0].tripId).toBeNull()
    expect(groups[0].tripName).toBe('Sin viaje asociado')
  })

  it('lista vacia retorna array vacio', () => {
    const groups = groupByTrip([], tripMap)
    expect(groups).toHaveLength(0)
  })

  it('ordenamiento: viajes con nombre alfabetico, "Sin viaje" al final', () => {
    const clients = [
      makeClient({
        id: 'c1',
        name: 'Ana',
        orders: [
          { orderId: 'o1', orderName: 'Vuelta', tripId: 'trip1', amountTotal: 100, dateOrder: null, source: 'platform' },
        ],
      }),
      makeClient({
        id: 'c2',
        name: 'Beto',
        source: 'odoo',
        orders: [
          { orderId: 'o2', orderName: 'S00999', amountTotal: 200, dateOrder: null, source: 'odoo' },
        ],
      }),
      makeClient({
        id: 'c3',
        name: 'Carlos',
        orders: [
          { orderId: 'o3', orderName: 'Europa', tripId: 'trip2', amountTotal: 300, dateOrder: null, source: 'platform' },
        ],
      }),
    ]

    const groups = groupByTrip(clients, tripMap)
    expect(groups).toHaveLength(3)
    // Europa Express < Vuelta al Mundo < Sin viaje
    expect(groups[0].tripName).toBe('Europa Express 15 dias')
    expect(groups[1].tripName).toBe('Vuelta al Mundo 33.8 dias')
    expect(groups[2].tripName).toBe('Sin viaje asociado')
  })

  it('(F5) totalAmount suma correctamente en MXN (no centavos)', () => {
    const clients = [
      makeClient({
        id: 'c1',
        name: 'Ana',
        orders: [
          { orderId: 'o1', orderName: 'Vuelta', tripId: 'trip1', amountTotal: 145000, dateOrder: null, source: 'platform' },
        ],
      }),
      makeClient({
        id: 'c2',
        name: 'Beto',
        orders: [
          { orderId: 'o2', orderName: 'Vuelta', tripId: 'trip1', amountTotal: 72500, dateOrder: null, source: 'platform' },
        ],
      }),
    ]

    const groups = groupByTrip(clients, tripMap)
    expect(groups[0].totalAmount).toBe(217500)
  })
})

describe('groupByClient', () => {
  it('cliente con ordenes de 2 viajes tiene sub-grupos correctos', () => {
    const clients = [
      makeClient({
        id: 'c1',
        name: 'Laura Mendez',
        orders: [
          { orderId: 'o1', orderName: 'Vuelta', tripId: 'trip1', amountTotal: 145000, dateOrder: null, source: 'platform' },
          { orderId: 'o2', orderName: 'Europa', tripId: 'trip2', amountTotal: 80000, dateOrder: null, source: 'platform' },
        ],
      }),
    ]

    const groups = groupByClient(clients, tripMap)
    expect(groups).toHaveLength(1)
    expect(groups[0].trips).toHaveLength(2)
    expect(groups[0].totalAmount).toBe(225000)
  })

  it('cliente sin ordenes tiene trips array vacio', () => {
    const clients = [
      makeClient({ id: 'c1', name: 'Nuevo Cliente' }),
    ]

    const groups = groupByClient(clients, tripMap)
    expect(groups).toHaveLength(1)
    expect(groups[0].trips).toHaveLength(0)
  })

  it('ordenamiento por nombre de cliente', () => {
    const clients = [
      makeClient({ id: 'c1', name: 'Zara' }),
      makeClient({ id: 'c2', name: 'Ana' }),
      makeClient({ id: 'c3', name: 'Marco' }),
    ]

    const groups = groupByClient(clients, tripMap)
    expect(groups[0].client.name).toBe('Ana')
    expect(groups[1].client.name).toBe('Marco')
    expect(groups[2].client.name).toBe('Zara')
  })
})
