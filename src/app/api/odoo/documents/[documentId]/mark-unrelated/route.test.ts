import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockRequirePermission = vi.fn()
const mockDocGet = vi.fn()
const mockDocSet = vi.fn()

vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '__SERVER_TIMESTAMP__' },
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ get: mockDocGet, set: mockDocSet }) }),
  },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: (error: unknown) => {
    const e = error as { status?: number; code?: string; message?: string }
    return NextResponse.json(
      { code: e?.code ?? 'ERROR', message: e?.message ?? 'Unknown' },
      { status: e?.status ?? 500 },
    )
  },
}))

function makeReq(body?: unknown) {
  return new Request('http://localhost/api/odoo/documents/1/mark-unrelated', {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : '',
    headers: { 'content-type': 'application/json' },
  })
}

async function callPOST(id: string, body?: unknown) {
  const { POST } = await import('./route')
  return POST(makeReq(body) as never, { params: Promise.resolve({ documentId: id }) })
}

describe('POST /api/odoo/documents/[documentId]/mark-unrelated', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockDocGet.mockReset()
    mockDocSet.mockReset().mockResolvedValue(undefined)
  })

  it('happy: marca como unrelated con reason y scope=unmatched', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDocGet.mockResolvedValue({ exists: true })
    const res = await callPOST('42', { reason: 'documento interno sin viaje' })
    const body = await res.json()
    expect(mockRequirePermission).toHaveBeenCalledWith('documents:manage')
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    const [payload, opts] = mockDocSet.mock.calls[0]
    expect(payload.adminOverride.markedUnrelated).toBe(true)
    expect(payload.adminOverride.markedUnrelatedReason).toBe('documento interno sin viaje')
    expect(payload.adminOverride.scope).toBe('unmatched')
    expect(payload.adminOverride.updatedBy).toBe('admin1')
    expect(opts).toEqual({ merge: true })
  })

  it('happy: body vacío válido (reason opcional)', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDocGet.mockResolvedValue({ exists: true })
    const res = await callPOST('42', {})
    expect(res.status).toBe(200)
    const [payload] = mockDocSet.mock.calls[0]
    expect(payload.adminOverride.markedUnrelatedReason).toBeNull()
  })

  it('400: reason muy corto', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDocGet.mockResolvedValue({ exists: true })
    const res = await callPOST('42', { reason: 'xx' })
    expect(res.status).toBe(400)
    expect(mockDocSet).not.toHaveBeenCalled()
  })

  it('404 si documento no existe', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDocGet.mockResolvedValue({ exists: false })
    const res = await callPOST('99', {})
    expect(res.status).toBe(404)
  })

  it('403 sin permiso', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso', 403, false),
    )
    const res = await callPOST('42', {})
    expect(res.status).toBe(403)
    expect(mockDocSet).not.toHaveBeenCalled()
  })
})
