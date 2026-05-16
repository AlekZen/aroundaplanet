import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockRequirePermission = vi.fn()
const mockFolderGet = vi.fn()
const mockMappingGet = vi.fn()
const mockMappingSet = vi.fn()

vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => '__SERVER_TIMESTAMP__',
  },
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: (name: string) => ({
      doc: () => ({
        get: name === 'odooDocumentFolders' ? mockFolderGet : mockMappingGet,
        set: mockMappingSet,
      }),
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
  return new Request('http://localhost/api/odoo/documents/folder-mappings', {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : '',
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/odoo/documents/folder-mappings', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockFolderGet.mockReset()
    mockMappingGet.mockReset()
    mockMappingSet.mockReset().mockResolvedValue(undefined)
  })

  it('happy: confirm crea mapping con status=confirmed y confidence 100', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockFolderGet.mockResolvedValue({ exists: true })
    mockMappingGet.mockResolvedValue({ exists: false, data: () => undefined })

    const { POST } = await import('./route')
    const res = await POST(makeReq({ folderId: 42, action: 'confirm', productId: 1748 }))
    const body = await res.json()

    expect(mockRequirePermission).toHaveBeenCalledWith('documents:manage')
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.folderId).toBe(42)
    expect(body.action).toBe('confirm')
    expect(body.created).toBe(true)
    expect(mockMappingSet).toHaveBeenCalledOnce()
    const [payload, opts] = mockMappingSet.mock.calls[0]
    expect(payload.status).toBe('confirmed')
    expect(payload.confidence).toBe(100)
    expect(payload.relatedProductId).toBe(1748)
    expect(payload.detectedBy).toBe('admin-manual')
    expect(payload.createdAt).toBe('__SERVER_TIMESTAMP__')
    expect(opts).toEqual({ merge: true })
  })

  it('idempotente: segundo call con mismo folder usa merge y NO setea createdAt', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockFolderGet.mockResolvedValue({ exists: true })
    mockMappingGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'confirmed', confidence: 100 }),
    })

    const { POST } = await import('./route')
    const res = await POST(makeReq({ folderId: 42, action: 'ignore' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.created).toBe(false)
    const [payload] = mockMappingSet.mock.calls[0]
    expect(payload.status).toBe('dismissed')
    expect(payload).not.toHaveProperty('createdAt')
  })

  it('400: body inválido (action desconocido)', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    const { POST } = await import('./route')
    const res = await POST(makeReq({ folderId: 42, action: 'nope' }))
    expect(res.status).toBe(400)
    expect(mockMappingSet).not.toHaveBeenCalled()
  })

  it('404 cuando folder no existe en mirror', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockFolderGet.mockResolvedValue({ exists: false })
    const { POST } = await import('./route')
    const res = await POST(makeReq({ folderId: 99, action: 'confirm' }))
    expect(res.status).toBe(404)
  })

  it('happy: unrelate emite status=auto y canonicalFolderId self-referente cuando no se pasa', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockFolderGet.mockResolvedValue({ exists: true })
    mockMappingGet.mockResolvedValue({ exists: false, data: () => undefined })
    const { POST } = await import('./route')
    const res = await POST(makeReq({ folderId: 77, action: 'unrelate' }))
    expect(res.status).toBe(200)
    const [payload] = mockMappingSet.mock.calls[0]
    expect(payload.status).toBe('auto')
    expect(payload.canonicalFolderId).toBe(77)
    expect(payload.relatedProductId).toBeNull()
  })

  it('happy: confirm con canonicalFolderId apunta a otro folder (cluster duplicado)', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockFolderGet.mockResolvedValue({ exists: true })
    mockMappingGet.mockResolvedValue({ exists: false, data: () => undefined })
    const { POST } = await import('./route')
    const res = await POST(makeReq({ folderId: 50, action: 'confirm', canonicalFolderId: 49, productId: 1748 }))
    expect(res.status).toBe(200)
    const [payload] = mockMappingSet.mock.calls[0]
    expect(payload.canonicalFolderId).toBe(49)
    expect(payload.duplicateFolderId).toBe(50)
  })

  it('happy: scopeOverride persiste en mapping', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockFolderGet.mockResolvedValue({ exists: true })
    mockMappingGet.mockResolvedValue({ exists: false, data: () => undefined })
    const { POST } = await import('./route')
    const res = await POST(makeReq({ folderId: 42, action: 'confirm', productId: 1, scopeOverride: 'contract' }))
    expect(res.status).toBe(200)
    const [payload] = mockMappingSet.mock.calls[0]
    expect(payload.scopeOverride).toBe('contract')
  })

  it('400: body no es JSON parseable', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/odoo/documents/folder-mappings', {
      method: 'POST',
      body: '{not-json',
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('400: folderId faltante (validación Zod) devuelve mensaje no-genérico', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    const { POST } = await import('./route')
    const res = await POST(makeReq({ action: 'confirm' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    // Finding 8-1b L1: respuesta debe contener un mensaje específico del error Zod,
    // no un genérico "Body inválido" sin pista de qué falló.
    expect(body.message).toBeTruthy()
    expect(body.message).not.toBe('Unknown')
  })

  it('403 sin permiso', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso documents:manage requerido', 403, false),
    )
    const { POST } = await import('./route')
    const res = await POST(makeReq({ folderId: 42, action: 'confirm' }))
    expect(res.status).toBe(403)
    expect(mockMappingSet).not.toHaveBeenCalled()
  })
})
