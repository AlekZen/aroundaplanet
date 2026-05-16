import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockRequireAuth = vi.fn()
const mockOrderGet = vi.fn()
const mockTripGet = vi.fn()
const mockUserGet = vi.fn()
const mockAgentGet = vi.fn()
const mockCountGet = vi.fn()
const mockNewContractSet = vi.fn()
const mockOrderUpdate = vi.fn()
const mockRenderAndUpload = vi.fn()

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}))

vi.mock('@/lib/pdf/contracts/generate', () => ({
  renderAndUploadContract: (...args: unknown[]) => mockRenderAndUpload(...args),
}))

const mockTxPrevSize = vi.fn(() => 0)

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: (col: string) => {
      if (col === 'orders') {
        return { doc: () => ({ get: mockOrderGet, update: mockOrderUpdate }) }
      }
      if (col === 'trips') {
        return { doc: () => ({ get: mockTripGet }) }
      }
      if (col === 'users') {
        return { doc: () => ({ get: mockUserGet }) }
      }
      if (col === 'odooAgents') {
        return { doc: () => ({ get: mockAgentGet }) }
      }
      if (col === 'contracts') {
        return {
          where: () => ({ count: () => ({ get: mockCountGet }) }),
          doc: () => ({ id: 'new-contract-id', set: mockNewContractSet }),
        }
      }
      throw new Error(`Unexpected collection ${col}`)
    },
    // Story 10.1 versionado transaccional: la transacción cuenta contratos previos
    // y reserva el slot. Mock invoca el callback con un `tx` que satisface el shape
    // mínimo usado por el route (tx.get → {size}, tx.set → noop).
    runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async () => ({ size: mockTxPrevSize() }),
        set: () => undefined,
      }
      return cb(tx)
    },
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    delete: () => 'DELETE_SENTINEL',
  },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: (error: unknown) => {
    if (error && typeof error === 'object' && 'status' in error) {
      const e = error as { status: number; code: string; message: string }
      return NextResponse.json({ code: e.code, message: e.message }, { status: e.status })
    }
    return NextResponse.json({ code: 'ERROR', message: 'Unknown' }, { status: 500 })
  },
}))

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/contracts/from-order/order1/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const ctx = { params: Promise.resolve({ orderId: 'order1' }) }

/** Default trip data — viaje COMPLETAMENTE configurado para contratos. */
const validTripData = {
  odooName: 'ASIA MAYO 2026',
  contractDisplayName: 'ASIA MAYO 2026',
  contractPlazoDias: 30,
  contractIncluye: ['Vuelos desde CDMX', 'Hotel 4 estrellas'],
  contractVisitamos: ['China', 'Malasia'],
  contractNoIncluye: [],
}

describe('POST /api/contracts/from-order/[orderId]/generate', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequireAuth.mockReset()
    mockOrderGet.mockReset()
    mockTripGet.mockReset().mockResolvedValue({ exists: true, data: () => validTripData })
    mockUserGet.mockReset().mockResolvedValue({ exists: false, data: () => null })
    mockAgentGet.mockReset().mockResolvedValue({ exists: false, data: () => null })
    mockCountGet.mockReset().mockResolvedValue({ data: () => ({ count: 0 }) })
    mockNewContractSet.mockReset().mockResolvedValue({})
    mockOrderUpdate.mockReset().mockResolvedValue({})
    mockRenderAndUpload
      .mockReset()
      .mockResolvedValue({ pdfUrl: 'https://signed/url', pdfStoragePath: 'contracts/order1/x.pdf' })
  })

  it('rechaza 403 sin rol admin', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'u1', roles: ['cliente'] })
    const { POST } = await import('./route')
    const res = await POST(makeReq({ templateId: 'trip:odoo-asia' }), ctx)
    expect(res.status).toBe(403)
  })

  it('404 cuando la orden no existe', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockOrderGet.mockResolvedValue({ exists: false })
    const { POST } = await import('./route')
    const res = await POST(makeReq({ templateId: 'trip:odoo-asia' }), ctx)
    expect(res.status).toBe(404)
  })

  it('400 cuando el viaje no tiene contractIncluye configurado', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockOrderGet.mockResolvedValue({
      exists: true,
      data: () => ({
        contactName: 'Felipe',
        amountTotalCents: 100000,
        tripId: 'odoo-asia',
        userId: 'u1',
      }),
    })
    mockTripGet.mockResolvedValue({
      exists: true,
      data: () => ({ odooName: 'ASIA', contractPlazoDias: 30 /* falta incluye */ }),
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq({ templateId: 'trip:odoo-asia' }), ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('TRIP_CONTRACT_NOT_CONFIGURED')
    expect(body.message).toContain('al menos 1 ítem')
  })

  it('happy path: genera contrato v1 leyendo datos del viaje', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockOrderGet.mockResolvedValue({
      exists: true,
      data: () => ({
        contactName: 'Felipe Rubio',
        amountTotalCents: 11500000,
        agentId: null,
        tripId: 'odoo-asia',
        userId: 'u-felipe',
      }),
    })

    const { POST } = await import('./route')
    const res = await POST(makeReq({ templateId: 'trip:odoo-asia' }), ctx)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.contractId).toBe('new-contract-id')
    expect(json.version).toBe(1)
    expect(mockRenderAndUpload).toHaveBeenCalledOnce()
    expect(mockNewContractSet).toHaveBeenCalledOnce()
  })

  it('rechaza order con amountTotalCents=0', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockOrderGet.mockResolvedValue({
      exists: true,
      data: () => ({ contactName: 'X', amountTotalCents: 0, tripId: 'odoo-asia' }),
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq({ templateId: 'trip:odoo-asia' }), ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('ORDER_MISSING_AMOUNT')
  })

  it('400 cuando la orden no tiene tripId', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockOrderGet.mockResolvedValue({
      exists: true,
      data: () => ({ contactName: 'X', amountTotalCents: 100000, tripId: null }),
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq({ templateId: 'trip:none' }), ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('TRIP_CONTRACT_NOT_CONFIGURED')
    expect(body.message).toContain('tripId')
  })
})
