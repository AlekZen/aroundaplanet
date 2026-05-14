import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: vi.fn().mockResolvedValue({ uid: 'admin-uid', roles: ['admin'] }),
}))

const mockUpdate = vi.fn()
let mockAlertData: { status: string } = { status: 'open' }
let mockAlertExists = true

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({
        get: vi.fn().mockImplementation(() =>
          Promise.resolve({
            exists: mockAlertExists,
            data: () => mockAlertData,
          }),
        ),
        update: mockUpdate,
      }),
    }),
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  },
}))

function makeRequest(body: unknown, alertId = 'alert-123') {
  return new NextRequest(`http://localhost/api/payment-alerts/${alertId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeContext(alertId = 'alert-123') {
  return { params: Promise.resolve({ alertId }) }
}

describe('PATCH /api/payment-alerts/[alertId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAlertData = { status: 'open' }
    mockAlertExists = true
    mockUpdate.mockResolvedValue(undefined)
  })

  it('alerta open → dismissed con nota válida', async () => {
    const { PATCH } = await import('./route')
    const req = makeRequest({ status: 'dismissed', resolutionNote: 'Verificado manualmente en Odoo' })
    const res = await PATCH(req, makeContext())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ dismissed: true })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'dismissed',
        resolutionNote: 'Verificado manualmente en Odoo',
      }),
    )
  })

  it('alerta ya dismissed → 409 already_resolved', async () => {
    mockAlertData = { status: 'dismissed' }
    const { PATCH } = await import('./route')
    const req = makeRequest({ status: 'dismissed', resolutionNote: 'Intento doble' })
    const res = await PATCH(req, makeContext())
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.code).toBe('already_resolved')
    expect(json.currentStatus).toBe('dismissed')
  })

  it('nota con menos de 5 chars → 400 VALIDATION_ERROR', async () => {
    const { PATCH } = await import('./route')
    const req = makeRequest({ status: 'dismissed', resolutionNote: 'ok' })
    const res = await PATCH(req, makeContext())
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('alerta no encontrada → 404', async () => {
    mockAlertExists = false
    const { PATCH } = await import('./route')
    const req = makeRequest({ status: 'dismissed', resolutionNote: 'Alerta inexistente' })
    const res = await PATCH(req, makeContext())

    expect(res.status).toBe(404)
  })
})
