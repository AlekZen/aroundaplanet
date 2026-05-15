import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockRequireAuth = vi.fn()
const mockEmptyGet = vi.fn()
const mockBatchCommit = vi.fn()
const mockBatchSet = vi.fn()
const mockListGet = vi.fn()

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      limit: () => ({ get: mockEmptyGet }),
      doc: () => ({}),
      orderBy: () => ({ get: mockListGet }),
    }),
    batch: () => ({ set: mockBatchSet, commit: mockBatchCommit }),
  },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: (error: unknown) => {
    if (error && typeof error === 'object' && 'status' in error) {
      const e = error as { status: number; code: string; message: string }
      return NextResponse.json({ code: e.code, message: e.message }, { status: e.status })
    }
    return NextResponse.json({ code: 'ERROR', message: 'Unknown' }, { status: 500 })
  },
}))

describe('GET /api/contract-templates', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequireAuth.mockReset()
    mockEmptyGet.mockReset()
    mockBatchCommit.mockReset().mockResolvedValue([])
    mockBatchSet.mockReset()
    mockListGet.mockReset()
  })

  it('rechaza 403 a usuarios sin rol admin/superadmin/director', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'u1', roles: ['cliente'] })
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('lazy-seed cuando la colección está vacía y devuelve templates', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    // First check: empty
    mockEmptyGet.mockResolvedValue({ empty: true })
    // After seed: lista con 1 doc
    mockListGet.mockResolvedValue({
      docs: [
        {
          id: 'vuelta-al-mundo',
          data: () => ({
            templateKey: 'vuelta-al-mundo',
            destinoLabel: 'VUELTA AL MUNDO',
            scope: 'internacional',
            plazoLimitePagoDias: 60,
            anexoIncluye: ['Vuelos'],
            anexoVisitamos: [],
            anexoNoIncluye: [],
            active: true,
            notes: null,
          }),
        },
      ],
    })

    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.templates).toHaveLength(1)
    expect(json.templates[0].templateKey).toBe('vuelta-al-mundo')
    expect(mockBatchCommit).toHaveBeenCalledOnce()
  })

  it('omite seed si ya existen templates', async () => {
    mockRequireAuth.mockResolvedValue({ uid: 'admin1', roles: ['superadmin'] })
    mockEmptyGet.mockResolvedValue({ empty: false })
    mockListGet.mockResolvedValue({ docs: [] })

    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(mockBatchCommit).not.toHaveBeenCalled()
  })
})
