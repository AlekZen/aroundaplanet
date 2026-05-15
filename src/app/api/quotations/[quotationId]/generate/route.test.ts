import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockRequireAuth = vi.fn()
const mockDocGet = vi.fn()
const mockDocUpdate = vi.fn()
const mockRender = vi.fn()

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}))

vi.mock('@/lib/pdf/quotations/generate', () => ({
  renderAndUploadQuotation: (...args: unknown[]) => mockRender(...args),
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ get: mockDocGet, update: mockDocUpdate }),
    }),
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

const ctx = { params: Promise.resolve({ quotationId: 'q-1' }) }

const validLead = {
  nombreCliente: 'Juan Pérez',
  tipoViaje: 'Internacional',
  destino: 'Madrid',
  fechaSalida: '2026-09-01',
  fechaRegreso: '2026-09-15',
  adultos: '2',
  menores: '0',
  habitaciones: '1',
  presupuesto: '$50K-$100K',
}

describe('POST /api/quotations/[quotationId]/generate', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequireAuth.mockReset()
    mockDocGet.mockReset()
    mockDocUpdate.mockReset().mockResolvedValue({})
    mockRender
      .mockReset()
      .mockResolvedValue({ pdfUrl: 'https://signed/q.pdf', pdfStoragePath: 'quotations/q-1/q-1.pdf' })
  })

  it('rechaza 403 sin rol admin/superadmin/director', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'u1', roles: ['cliente'] })
    const { POST } = await import('./route')
    const res = await POST({} as NextRequest, ctx)
    expect(res.status).toBe(403)
  })

  it('404 cuando la cotización no existe', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDocGet.mockResolvedValue({ exists: false })
    const { POST } = await import('./route')
    const res = await POST({} as NextRequest, ctx)
    expect(res.status).toBe(404)
  })

  it('happy path: genera PDF v1 y actualiza status', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ pdfVersion: 0, leadSnapshot: validLead }),
    })
    const { POST } = await import('./route')
    const res = await POST({} as NextRequest, ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.pdfVersion).toBe(1)
    expect(json.pdfUrl).toBe('https://signed/q.pdf')
    expect(mockDocUpdate).toHaveBeenCalledOnce()
    const updateArg = mockDocUpdate.mock.calls[0]![0]
    expect(updateArg.status).toBe('pdf-generated')
    expect(updateArg.pdfVersion).toBe(1)
  })

  it('regeneración: incrementa version v2', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ pdfVersion: 1, leadSnapshot: validLead }),
    })
    const { POST } = await import('./route')
    const res = await POST({} as NextRequest, ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.pdfVersion).toBe(2)
  })

  it('422 si leadSnapshot corrupto en Firestore', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ pdfVersion: 0, leadSnapshot: { nombreCliente: 'X' } }),
    })
    const { POST } = await import('./route')
    const res = await POST({} as NextRequest, ctx)
    expect(res.status).toBe(422)
  })
})
