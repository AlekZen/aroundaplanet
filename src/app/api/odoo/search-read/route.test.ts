import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock auth
vi.mock('@/lib/auth/requireRole', () => ({
  requireRole: vi.fn().mockResolvedValue({ uid: 'admin-uid', roles: ['cliente', 'admin'], agentId: undefined }),
}))

// Mock OdooClient
const mockSearchRead = vi.fn()
vi.mock('@/lib/odoo/client', () => ({
  getOdooClient: vi.fn(() => ({
    searchRead: mockSearchRead,
  })),
}))

// Mock cache — pass through to fetchFn directly
vi.mock('@/lib/odoo/cache', () => ({
  withCacheFallback: vi.fn((_model: string, _key: string, fetchFn: () => Promise<unknown>) =>
    fetchFn().then((data: unknown) => ({ data, cachedAt: new Date(), isStale: false }))
  ),
}))

import { POST } from './route'
import { requireRole } from '@/lib/auth/requireRole'
import { AppError } from '@/lib/errors/AppError'

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/odoo/search-read', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/odoo/search-read', () => {
  beforeEach(() => {
    mockSearchRead.mockReset()
    vi.mocked(requireRole).mockResolvedValue({
      uid: 'admin-uid',
      roles: ['cliente', 'admin'],
      agentId: undefined,
    })
  })

  it('valida auth con requireRole admin', async () => {
    mockSearchRead.mockResolvedValue([])

    await POST(createRequest({
      model: 'res.partner',
      fields: ['name'],
    }))

    expect(requireRole).toHaveBeenCalledWith('admin')
  })

  it('retorna datos de searchRead', async () => {
    mockSearchRead.mockResolvedValue([{ id: 1, name: 'Test Partner' }])

    const response = await POST(createRequest({
      model: 'res.partner',
      domain: [['is_company', '=', true]],
      fields: ['name', 'email'],
      limit: 10,
    }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual([{ id: 1, name: 'Test Partner' }])
  })

  it('rechaza request sin model', async () => {
    const response = await POST(createRequest({
      fields: ['name'],
    }))

    expect(response.status).toBe(500) // Zod error -> handleApiError -> 500
  })

  it('rechaza request sin fields', async () => {
    const response = await POST(createRequest({
      model: 'res.partner',
      fields: [],
    }))

    expect(response.status).toBe(500)
  })

  it('retorna 403 cuando el usuario no es admin', async () => {
    vi.mocked(requireRole).mockRejectedValue(
      new AppError('INSUFFICIENT_ROLE', 'Se requiere rol admin', 403, false)
    )

    const response = await POST(createRequest({
      model: 'res.partner',
      fields: ['name'],
    }))

    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.code).toBe('INSUFFICIENT_ROLE')
  })

  it('retorna error Odoo cuando el cliente falla', async () => {
    mockSearchRead.mockRejectedValue(
      new AppError('ODOO_TIMEOUT', 'Odoo no respondio', 503, true)
    )

    const response = await POST(createRequest({
      model: 'res.partner',
      fields: ['name'],
    }))

    expect(response.status).toBe(503)
    const json = await response.json()
    expect(json.code).toBe('ODOO_TIMEOUT')
    expect(json.retryable).toBe(true)
  })
})
