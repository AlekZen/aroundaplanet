import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockFetchOverview = vi.fn()
vi.mock('@/lib/odoo/models/documents', () => ({
  fetchOdooDocumentsOverview: (...args: unknown[]) => mockFetchOverview(...args),
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: (error: unknown) => {
    const status = (error as { status?: number })?.status ?? 500
    const code = (error as { code?: string })?.code ?? 'ERROR'
    const message = error instanceof Error ? error.message : 'Unknown'
    return NextResponse.json({ code, message }, { status })
  },
}))

describe('GET /api/odoo/documents', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockFetchOverview.mockReset()
  })

  it('requires documents:read permission and returns overview', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockFetchOverview.mockResolvedValue({ counts: { productDocuments: 1, folders: 2, backofficeDocuments: 3 }, generatedAt: '2026-05-16T00:00:00Z' })

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/odoo/documents'))
    const body = await res.json()

    expect(mockRequirePermission).toHaveBeenCalledWith('documents:read')
    expect(res.status).toBe(200)
    expect(body.counts.folders).toBe(2)
    expect(mockFetchOverview).toHaveBeenCalledWith({
      productLimit: 800,
      productDocumentLimit: 500,
      folderLimit: 250,
      backofficeDocumentLimit: 500,
    })
  })

  it('passes empty options when mode=full', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockFetchOverview.mockResolvedValue({ counts: { productDocuments: 0, folders: 0, backofficeDocuments: 0 }, generatedAt: 'x' })

    const { GET } = await import('./route')
    await GET(new Request('http://localhost/api/odoo/documents?mode=full'))

    expect(mockFetchOverview).toHaveBeenCalledWith({})
  })

  it('returns 403 when permission missing', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso documents:read requerido', 403, false)
    )

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/odoo/documents'))

    expect(res.status).toBe(403)
    expect(mockFetchOverview).not.toHaveBeenCalled()
  })
})
