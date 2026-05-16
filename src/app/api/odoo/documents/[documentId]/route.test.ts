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
    collection: () => ({
      doc: () => ({ get: mockDocGet, set: mockDocSet }),
    }),
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
  return new Request('http://localhost/api/odoo/documents/1', {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : '',
    headers: { 'content-type': 'application/json' },
  })
}

async function callPATCH(id: string, body?: unknown) {
  const { PATCH } = await import('./route')
  return PATCH(makeReq(body) as never, { params: Promise.resolve({ documentId: id }) })
}

describe('PATCH /api/odoo/documents/[documentId]', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockDocGet.mockReset()
    mockDocSet.mockReset().mockResolvedValue(undefined)
  })

  it('happy: actualiza scopeOverride + relatedProductId en adminOverride', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDocGet.mockResolvedValue({ exists: true })
    const res = await callPATCH('42', {
      scopeOverride: 'contract',
      relatedProductId: 1748,
      relatedProductName: 'ASIA MAYO',
    })
    const body = await res.json()
    expect(mockRequirePermission).toHaveBeenCalledWith('documents:manage')
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.documentId).toBe(42)
    const [payload, opts] = mockDocSet.mock.calls[0]
    expect(payload.adminOverride.scope).toBe('contract')
    expect(payload.adminOverride.relatedProductId).toBe(1748)
    expect(payload.adminOverride.relatedProductName).toBe('ASIA MAYO')
    expect(payload.adminOverride.updatedBy).toBe('admin1')
    expect(opts).toEqual({ merge: true })
  })

  it('400: body sin ningún campo (refine fail)', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDocGet.mockResolvedValue({ exists: true })
    const res = await callPATCH('42', {})
    expect(res.status).toBe(400)
    expect(mockDocSet).not.toHaveBeenCalled()
  })

  it('400: documentId inválido', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    const res = await callPATCH('abc', { scopeOverride: 'contract' })
    expect(res.status).toBe(400)
  })

  it('404: documento no existe en mirror', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDocGet.mockResolvedValue({ exists: false })
    const res = await callPATCH('99', { scopeOverride: 'contract' })
    expect(res.status).toBe(404)
  })

  it.each(['payment', 'contract', 'quote', 'sales', 'coupon', 'trip-backoffice'] as const)(
    'happy: acepta scopeOverride=%s',
    async (scope) => {
      mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
      mockDocGet.mockResolvedValue({ exists: true })
      const res = await callPATCH('42', { scopeOverride: scope })
      expect(res.status).toBe(200)
      const [payload] = mockDocSet.mock.calls[0]
      expect(payload.adminOverride.scope).toBe(scope)
    },
  )

  it('400: scopeOverride inválido', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDocGet.mockResolvedValue({ exists: true })
    const res = await callPATCH('42', { scopeOverride: 'not-a-real-scope' })
    expect(res.status).toBe(400)
    expect(mockDocSet).not.toHaveBeenCalled()
  })

  it('merge:true preserva campos pull: el set NO incluye scope top-level (solo nested adminOverride)', async () => {
    // Garantiza el invariante de 9.3: el pull escribe campos top-level (scope, relationStatus),
    // el PATCH solo escribe nested adminOverride.* → un pull posterior NO sobreescribe el override.
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDocGet.mockResolvedValue({ exists: true })
    await callPATCH('42', { scopeOverride: 'payment' })
    const [payload, opts] = mockDocSet.mock.calls[0]
    expect(Object.keys(payload)).toEqual(['adminOverride'])
    expect(payload).not.toHaveProperty('scope')
    expect(payload).not.toHaveProperty('relationStatus')
    expect(opts).toEqual({ merge: true })
  })

  it('idempotente: dos PATCH consecutivos con mismo body emiten 2 set() merge', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDocGet.mockResolvedValue({ exists: true })
    await callPATCH('42', { scopeOverride: 'payment' })
    await callPATCH('42', { scopeOverride: 'payment' })
    expect(mockDocSet).toHaveBeenCalledTimes(2)
  })

  it('403 sin permiso', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso requerido', 403, false),
    )
    const res = await callPATCH('42', { scopeOverride: 'contract' })
    expect(res.status).toBe(403)
    expect(mockDocSet).not.toHaveBeenCalled()
  })
})
