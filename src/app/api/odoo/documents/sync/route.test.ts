import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockSyncOdooDocuments = vi.fn()
vi.mock('@/lib/odoo/documents-pull', async () => {
  const actual = await vi.importActual<typeof import('@/lib/odoo/documents-pull')>(
    '@/lib/odoo/documents-pull',
  )
  return {
    ...actual,
    syncOdooDocuments: (...args: unknown[]) => mockSyncOdooDocuments(...args),
  }
})

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: (error: unknown) => {
    const status = (error as { status?: number })?.status ?? 500
    const code = (error as { code?: string })?.code ?? 'ERROR'
    const message = error instanceof Error ? error.message : 'Unknown'
    return NextResponse.json({ code, message }, { status })
  },
}))

function makeReq(body?: unknown) {
  return new Request('http://localhost/api/odoo/documents/sync', {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : '',
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/odoo/documents/sync', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockSyncOdooDocuments.mockReset()
  })

  it('requiere documents:manage y retorna summary completo', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'a1', roles: ['admin'] })
    mockSyncOdooDocuments.mockResolvedValue({
      created: 0,
      updated: 12,
      skipped: 0,
      errored: 0,
      fetched: 12,
      cursor: '2026-05-16 12:00:00',
      durationMs: 1234,
      runId: 'r1',
      dryRun: false,
    })

    const { POST } = await import('./route')
    const res = await POST(makeReq({}))
    const body = await res.json()

    expect(mockRequirePermission).toHaveBeenCalledWith('documents:manage')
    expect(res.status).toBe(200)
    expect(body.updated).toBe(12)
    expect(body.cursor).toBe('2026-05-16 12:00:00')
    expect(body.runId).toBe('r1')
  })

  it('pasa dryRun y full al helper', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'a1', roles: ['admin'] })
    mockSyncOdooDocuments.mockResolvedValue({
      created: 0,
      updated: 0,
      skipped: 0,
      errored: 0,
      fetched: 0,
      cursor: '2026-05-16 12:00:00',
      durationMs: 1,
      runId: 'r2',
      dryRun: true,
    })
    const { POST } = await import('./route')
    await POST(makeReq({ dryRun: true, full: true }))
    expect(mockSyncOdooDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true, full: true }),
    )
  })

  it('rechaza batchSize fuera de rango con 400', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'a1', roles: ['admin'] })
    const { POST } = await import('./route')
    const res = await POST(makeReq({ batchSize: 10 }))
    expect(res.status).toBe(400)
    expect(mockSyncOdooDocuments).not.toHaveBeenCalled()
  })

  it('retorna 409 ALREADY_SYNCING si otro run activo', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'a1', roles: ['admin'] })
    const { DocumentsSyncLockError } = await import('@/lib/odoo/documents-pull')
    mockSyncOdooDocuments.mockRejectedValue(new DocumentsSyncLockError('other-run-id'))

    const { POST } = await import('./route')
    const res = await POST(makeReq({}))
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.code).toBe('ALREADY_SYNCING')
    expect(body.currentRunId).toBe('other-run-id')
  })

  it('retorna 403 sin permiso', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso documents:manage requerido', 403, false),
    )
    const { POST } = await import('./route')
    const res = await POST(makeReq({}))
    expect(res.status).toBe(403)
    expect(mockSyncOdooDocuments).not.toHaveBeenCalled()
  })

  it('acepta body vacío (sin Content)', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'a1', roles: ['admin'] })
    mockSyncOdooDocuments.mockResolvedValue({
      created: 0,
      updated: 0,
      skipped: 0,
      errored: 0,
      fetched: 0,
      cursor: '2026-05-16 12:00:00',
      durationMs: 1,
      runId: 'r1',
      dryRun: false,
    })
    const { POST } = await import('./route')
    const res = await POST(
      new Request('http://localhost/api/odoo/documents/sync', { method: 'POST' }),
    )
    expect(res.status).toBe(200)
  })
})
