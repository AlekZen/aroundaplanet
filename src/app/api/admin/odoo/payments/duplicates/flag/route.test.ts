import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockSet = vi.fn()
const mockDelete = vi.fn()
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ set: mockSet, delete: mockDelete }) }),
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'TS' },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: (error: unknown) => {
    if (error && typeof error === 'object' && 'status' in error) {
      const e = error as { status: number; code: string; message: string }
      return NextResponse.json({ code: e.code, message: e.message }, { status: e.status })
    }
    return NextResponse.json({ code: 'ERROR' }, { status: 500 })
  },
}))

const mkRequest = (method: string, body: unknown) =>
  new NextRequest('http://localhost/x', { method, body: JSON.stringify(body) })

describe('POST/DELETE /flag', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockSet.mockReset()
    mockDelete.mockReset()
  })

  it('POST crea flag Firestore-only', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockSet.mockResolvedValue({})

    const { POST } = await import('./route')
    const res = await POST(mkRequest('POST', { clusterId: 'c_1_2', memberOdooIds: [1, 2], note: 'revisar manana' }))
    expect(res.status).toBe(200)
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ clusterId: 'c_1_2', flaggedBy: 'admin1', note: 'revisar manana' }),
      { merge: false },
    )
  })

  it('DELETE quita flag', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockDelete.mockResolvedValue({})

    const { DELETE } = await import('./route')
    const res = await DELETE(mkRequest('DELETE', { clusterId: 'c_1_2' }))
    expect(res.status).toBe(200)
  })

  it('POST 400 si body inválido', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })

    const { POST } = await import('./route')
    const res = await POST(mkRequest('POST', { clusterId: 'c_1', memberOdooIds: [1] }))
    expect(res.status).toBe(400)
  })
})
