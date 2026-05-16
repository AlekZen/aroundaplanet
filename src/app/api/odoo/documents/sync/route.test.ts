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

describe('POST /api/odoo/documents/sync', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockFetchOverview.mockReset()
  })

  it('requires documents:manage permission and returns counts', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockFetchOverview.mockResolvedValue({
      counts: { productDocuments: 5, folders: 2, backofficeDocuments: 3 },
      generatedAt: '2026-05-16T00:00:00Z',
    })

    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json()

    expect(mockRequirePermission).toHaveBeenCalledWith('documents:manage')
    expect(res.status).toBe(200)
    expect(body.total).toBe(10)
    expect(body.updated).toBe(10)
    expect(body.created).toBe(0)
  })

  it('returns 403 when permission missing', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso documents:manage requerido', 403, false)
    )

    const { POST } = await import('./route')
    const res = await POST()

    expect(res.status).toBe(403)
    expect(mockFetchOverview).not.toHaveBeenCalled()
  })
})
