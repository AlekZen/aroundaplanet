import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: vi.fn().mockResolvedValue({ uid: 'admin-uid', roles: ['admin'] }),
}))

describe('POST /api/payments/[paymentId]/retry-attachment', () => {
  it('devuelve 501 con shape correcto', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/payments/pay-123/retry-attachment', {
      method: 'POST',
    })
    const res = await POST(req, { params: Promise.resolve({ paymentId: 'pay-123' }) })
    const json = await res.json()

    expect(res.status).toBe(501)
    expect(json).toEqual({
      code: 'not_implemented',
      message: 'Pendiente Story 9.4 - retry attachment',
      storyDeps: ['9.4'],
    })
  })
})
