import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockTryAuth = vi.fn()
const mockSet = vi.fn()
const mockDocId = 'q-abc123'

vi.mock('@/lib/auth/tryAuth', () => ({
  tryAuth: (...args: unknown[]) => mockTryAuth(...args),
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ id: mockDocId, set: mockSet }),
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

function makeReq(body: unknown, ip = '1.2.3.4'): NextRequest {
  return new NextRequest('http://localhost/api/quotations', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  })
}

const validBody = {
  source: 'cotizar-public',
  whatsappSent: true,
  leadSnapshot: {
    nombreCliente: 'Juan Pérez',
    tipoViaje: 'Nacional',
    destino: 'Cancún',
    fechaSalida: '2026-07-01',
    fechaRegreso: '2026-07-08',
    adultos: '2',
    menores: '0',
    habitaciones: '1',
    presupuesto: '$25K-$50K',
  },
}

describe('POST /api/quotations', () => {
  beforeEach(() => {
    vi.resetModules()
    mockTryAuth.mockReset()
    mockSet.mockReset().mockResolvedValue({})
  })

  it('persiste el lead y devuelve quotationId', async () => {
    mockTryAuth.mockResolvedValue(null)
    const { POST } = await import('./route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.quotationId).toBe(mockDocId)
    expect(mockSet).toHaveBeenCalledOnce()
  })

  it('rechaza source no permitido (403)', async () => {
    mockTryAuth.mockResolvedValue(null)
    const { POST } = await import('./route')
    const res = await POST(makeReq({ ...validBody, source: 'admin-manual' }))
    expect(res.status).toBe(403)
  })

  it('rechaza payload inválido (400)', async () => {
    mockTryAuth.mockResolvedValue(null)
    const { POST } = await import('./route')
    const res = await POST(makeReq({ source: 'cotizar-public' }))
    expect(res.status).toBe(400)
  })

  it('aplica rate limit tras 10 hits del mismo IP', async () => {
    mockTryAuth.mockResolvedValue(null)
    const { POST } = await import('./route')
    // 10 hits válidos
    for (let i = 0; i < 10; i++) {
      const r = await POST(makeReq(validBody, '9.9.9.9'))
      expect(r.status).toBe(201)
    }
    const blocked = await POST(makeReq(validBody, '9.9.9.9'))
    expect(blocked.status).toBe(429)
  })
})
