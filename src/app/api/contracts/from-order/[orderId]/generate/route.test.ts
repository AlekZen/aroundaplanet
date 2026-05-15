import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockRequireAuth = vi.fn()
const mockOrderGet = vi.fn()
const mockTemplateGet = vi.fn()
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

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: (col: string) => {
      if (col === 'orders') {
        return {
          doc: () => ({ get: mockOrderGet, update: mockOrderUpdate }),
        }
      }
      if (col === 'contractTemplates') {
        return { doc: () => ({ get: mockTemplateGet }) }
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
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
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

describe('POST /api/contracts/from-order/[orderId]/generate', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequireAuth.mockReset()
    mockOrderGet.mockReset()
    mockTemplateGet.mockReset()
    mockTripGet.mockReset().mockResolvedValue({ exists: true, data: () => ({ odooName: 'VUELTA AL MUNDO 2026' }) })
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
    const res = await POST(makeReq({ templateId: 'vam' }), ctx)
    expect(res.status).toBe(403)
  })

  it('404 cuando la orden no existe', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockOrderGet.mockResolvedValue({ exists: false })
    mockTemplateGet.mockResolvedValue({
      exists: true,
      id: 'vam',
      data: () => ({
        templateKey: 'vuelta-al-mundo',
        destinoLabel: 'VUELTA AL MUNDO',
        scope: 'internacional',
        plazoLimitePagoDias: 60,
        anexoIncluye: ['x'],
        active: true,
      }),
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq({ templateId: 'vam' }), ctx)
    expect(res.status).toBe(404)
  })

  it('happy path: genera contrato v1 y backlinka la orden', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockOrderGet.mockResolvedValue({
      exists: true,
      data: () => ({
        contactName: 'Felipe Rubio',
        amountTotalCents: 11500000,
        agentId: null,
        tripId: 'odoo-vam',
        userId: 'u-felipe',
      }),
    })
    mockTemplateGet.mockResolvedValue({
      exists: true,
      id: 'vuelta-al-mundo',
      data: () => ({
        templateKey: 'vuelta-al-mundo',
        destinoLabel: 'VUELTA AL MUNDO',
        scope: 'internacional',
        plazoLimitePagoDias: 60,
        anexoIncluye: ['Vuelos'],
        anexoVisitamos: [],
        anexoNoIncluye: [],
        active: true,
        notes: null,
      }),
    })

    const { POST } = await import('./route')
    const res = await POST(makeReq({ templateId: 'vuelta-al-mundo' }), ctx)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.contractId).toBe('new-contract-id')
    expect(json.version).toBe(1)
    expect(json.pdfUrl).toBe('https://signed/url')
    expect(mockRenderAndUpload).toHaveBeenCalledOnce()
    expect(mockNewContractSet).toHaveBeenCalledOnce()
    expect(mockOrderUpdate).toHaveBeenCalledOnce()
  })

  it('versionado: cuenta contratos previos y suma 1', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockOrderGet.mockResolvedValue({
      exists: true,
      data: () => ({ contactName: 'Juan Test', amountTotalCents: 100000, tripId: 'odoo-asia' }),
    })
    mockTripGet.mockResolvedValue({ exists: true, data: () => ({ odooName: 'ASIA MAYO 2026' }) })
    mockTemplateGet.mockResolvedValue({
      exists: true,
      id: 'asia',
      data: () => ({
        templateKey: 'asia',
        destinoLabel: 'ASIA',
        scope: 'internacional',
        plazoLimitePagoDias: 30,
        anexoIncluye: ['Vuelos'],
        anexoVisitamos: [],
        anexoNoIncluye: [],
        active: true,
        notes: null,
      }),
    })
    mockCountGet.mockResolvedValue({ data: () => ({ count: 2 }) })

    const { POST } = await import('./route')
    const res = await POST(makeReq({ templateId: 'asia' }), ctx)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.version).toBe(3)
  })

  it('rechaza order con amountTotalCents=0', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockOrderGet.mockResolvedValue({
      exists: true,
      data: () => ({ contactName: 'X', amountTotalCents: 0 }),
    })
    mockTemplateGet.mockResolvedValue({
      exists: true,
      id: 'asia',
      data: () => ({
        templateKey: 'asia',
        destinoLabel: 'ASIA',
        scope: 'internacional',
        plazoLimitePagoDias: 30,
        anexoIncluye: ['Vuelos'],
        active: true,
      }),
    })

    const { POST } = await import('./route')
    const res = await POST(makeReq({ templateId: 'asia' }), ctx)
    expect(res.status).toBe(400)
  })
})
