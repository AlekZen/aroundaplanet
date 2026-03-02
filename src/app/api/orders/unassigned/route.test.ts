import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRequirePermission, mockCollection, mockGet, mockWhere, mockOrderBy, mockSelect } = vi.hoisted(() => {
  const mockRequirePermission = vi.fn()
  const mockGet = vi.fn()
  const mockWhere = vi.fn()
  const mockOrderBy = vi.fn()
  const mockSelect = vi.fn()
  const mockCollection = vi.fn()
  return { mockRequirePermission, mockCollection, mockGet, mockWhere, mockOrderBy, mockSelect }
})

vi.mock('@/lib/auth/requirePermission', () => ({ requirePermission: mockRequirePermission }))
vi.mock('@/lib/firebase/admin', () => ({ adminDb: { collection: mockCollection } }))
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: vi.fn(() => ({})) } }))

vi.mock('@/lib/errors/AppError', () => ({
  AppError: class AppError extends Error {
    constructor(public code: string, message: string, public status: number = 500, public retryable: boolean = false) {
      super(message); this.name = 'AppError'
    }
  },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: vi.fn((error: unknown) => {
    if (error instanceof Error && 'status' in error) {
      const e = error as unknown as { code: string; message: string; status: number; retryable: boolean }
      return Response.json({ code: e.code, message: e.message, retryable: e.retryable }, { status: e.status })
    }
    return Response.json({ code: 'INTERNAL_ERROR', message: 'Error', retryable: true }, { status: 500 })
  }),
}))

import { GET } from './route'

describe('GET /api/orders/unassigned', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequirePermission.mockResolvedValue({ uid: 'admin-1', roles: ['admin'] })

    mockGet.mockResolvedValue({ docs: [] })
    mockSelect.mockReturnValue({ get: mockGet })
    mockOrderBy.mockReturnValue({ select: mockSelect })
    mockWhere.mockReturnValue({ orderBy: mockOrderBy })

    mockCollection.mockImplementation((name: string) => {
      if (name === 'orders') return { where: mockWhere }
      if (name === 'trips') return { doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) }) }
      return {}
    })
  })

  it('returns unassigned orders', async () => {
    mockGet.mockResolvedValue({
      docs: [
        { id: 'o1', data: () => ({ contactName: 'Ana', contactPhone: '+525551234567', tripId: 'trip-1', status: 'Interesado', amountTotalCents: 14500000, createdAt: {} }) },
      ],
    })
    const mockTripGet = vi.fn().mockResolvedValue({ exists: true, id: 'trip-1', data: () => ({ odooName: 'Europa Express' }) })
    mockCollection.mockImplementation((name: string) => {
      if (name === 'orders') return { where: mockWhere }
      if (name === 'trips') return { doc: vi.fn().mockReturnValue({ get: mockTripGet }) }
      return {}
    })

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.orders).toHaveLength(1)
    expect(data.orders[0].contactName).toBe('Ana')
    expect(data.orders[0].tripName).toBe('Europa Express')
    expect(mockWhere).toHaveBeenCalledWith('agentId', '==', null)
  })

  it('returns 403 for unauthorized users', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(new AppError('INSUFFICIENT_PERMISSION', 'No', 403, false))

    const res = await GET()
    expect(res.status).toBe(403)
  })
})
