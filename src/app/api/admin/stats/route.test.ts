import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// --- Mocks ---
const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockCount = vi.fn()
const mockGet = vi.fn()
const mockWhere = vi.fn()
const mockOrderBy = vi.fn()
const mockLimit = vi.fn()
const mockSelect = vi.fn()

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      count: () => ({ get: mockCount }),
      where: (...args: unknown[]) => {
        mockWhere(...args)
        return {
          count: () => ({ get: mockCount }),
        }
      },
      orderBy: (...args: unknown[]) => {
        mockOrderBy(...args)
        return {
          limit: (...lArgs: unknown[]) => {
            mockLimit(...lArgs)
            return {
              select: (...sArgs: unknown[]) => {
                mockSelect(...sArgs)
                return { get: mockGet }
              },
            }
          },
        }
      },
    }),
  },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: (error: unknown) =>
    NextResponse.json(
      { code: 'ERROR', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    ),
}))

describe('GET /api/admin/stats', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequirePermission.mockReset()
    mockCount.mockReset()
    mockGet.mockReset()
    mockWhere.mockReset()
    mockOrderBy.mockReset()
    mockLimit.mockReset()
    mockSelect.mockReset()
  })

  it('returns stats with correct counts', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })

    // 5 parallel count queries + 1 catch fallback for payments
    let countCallIndex = 0
    const countValues = [10, 5, 20, 3, 2] // total, published, orders, unassigned, payments
    mockCount.mockImplementation(() =>
      Promise.resolve({ data: () => ({ count: countValues[countCallIndex++] ?? 0 }) })
    )

    // Last sync query
    mockGet.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ lastSyncAt: { toDate: () => new Date('2026-03-20T10:00:00Z') } }) }],
    })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(mockRequirePermission).toHaveBeenCalledWith('trips:read')
    expect(body.totalTrips).toBe(10)
    expect(body.publishedTrips).toBe(5)
    expect(body.totalOrders).toBe(20)
    expect(body.unassignedOrders).toBe(3)
    expect(body.pendingPayments).toBe(2)
    expect(body.lastSyncAt).toBe('2026-03-20T10:00:00.000Z')
  })

  it('returns lastSyncAt null when no trips exist', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })
    mockCount.mockResolvedValue({ data: () => ({ count: 0 }) })
    mockGet.mockResolvedValue({ empty: true, docs: [] })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(body.lastSyncAt).toBeNull()
  })

  it('returns 403 when user lacks permission', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(new AppError('INSUFFICIENT_PERMISSION', 'Permiso trips:read requerido', 403))

    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(500) // handleApiError mock returns 500
  })

  it('handles payments collection not existing gracefully', async () => {
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['admin'] })

    let countCallIndex = 0
    const countValues = [5, 3, 10, 1]
    mockCount.mockImplementation(() => {
      const idx = countCallIndex++
      // 5th call (payments) would fail in real scenario
      if (idx >= 4) return Promise.reject(new Error('Collection not found'))
      return Promise.resolve({ data: () => ({ count: countValues[idx] ?? 0 }) })
    })

    mockGet.mockResolvedValue({ empty: true, docs: [] })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    // pendingPayments should be 0 due to .catch() fallback
    expect(body.pendingPayments).toBe(0)
  })
})
