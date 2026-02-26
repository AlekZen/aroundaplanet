import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockRequirePermission = vi.hoisted(() => vi.fn())
const mockGet = vi.hoisted(() => vi.fn())
const mockDocGet = vi.hoisted(() => vi.fn())
const mockCountGet = vi.hoisted(() => vi.fn())

// Build a chainable mock that always returns itself
const chainable = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.where = vi.fn(() => chain)
  chain.orderBy = vi.fn(() => chain)
  chain.startAfter = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.get = vi.fn()
  chain.count = vi.fn(() => ({ get: vi.fn() }))
  chain.doc = vi.fn(() => ({ get: vi.fn() }))
  return chain
})

vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: mockRequirePermission,
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn(() => chainable),
  },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: vi.fn((error: unknown) => {
    const err = error as { status?: number; code?: string; message?: string }
    return Response.json(
      { code: err.code ?? 'ERROR', message: err.message ?? 'Error' },
      { status: err.status ?? 500 }
    )
  }),
}))

function makeDocs(users: Array<{ uid: string; displayName: string; email: string; isActive: boolean; roles: string[] }>) {
  return users.map((u) => ({
    id: u.uid,
    data: () => ({ displayName: u.displayName, email: u.email, isActive: u.isActive, roles: u.roles }),
  }))
}

describe('GET /api/users', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockRequirePermission.mockResolvedValue({ uid: 'admin1', roles: ['superadmin'] })

    // Reset chainable mocks but keep chaining behavior
    chainable.where.mockClear().mockImplementation(() => chainable)
    chainable.orderBy.mockClear().mockImplementation(() => chainable)
    chainable.startAfter.mockClear().mockImplementation(() => chainable)
    chainable.limit.mockClear().mockImplementation(() => chainable)
    chainable.get.mockReset()
    chainable.count.mockClear().mockReturnValue({
      get: mockCountGet.mockReset().mockResolvedValue({ data: () => ({ count: 0 }) }),
    })
    chainable.doc.mockClear().mockReturnValue({
      get: mockDocGet.mockReset().mockResolvedValue({ exists: false }),
    })
  })

  it('requires users:read permission', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequirePermission.mockRejectedValue(new AppError('INSUFFICIENT_PERMISSION', 'Permiso users:read requerido', 403, false))

    const { GET } = await import('./route')
    const request = new NextRequest('http://localhost/api/users')
    const response = await GET(request)

    expect(response.status).toBe(403)
    expect(mockRequirePermission).toHaveBeenCalledWith('users:read')
  })

  it('returns paginated user list', async () => {
    const users = makeDocs([
      { uid: 'u1', displayName: 'Alice', email: 'alice@test.com', isActive: true, roles: ['cliente'] },
      { uid: 'u2', displayName: 'Bob', email: 'bob@test.com', isActive: true, roles: ['cliente', 'admin'] },
    ])
    chainable.get.mockResolvedValue({ docs: users })
    mockCountGet.mockResolvedValue({ data: () => ({ count: 2 }) })

    const { GET } = await import('./route')
    const request = new NextRequest('http://localhost/api/users')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.users).toHaveLength(2)
    expect(body.users[0].uid).toBe('u1')
    expect(body.nextCursor).toBeNull()
    expect(body.total).toBe(2)
  })

  it('filters by statusFilter=active', async () => {
    chainable.get.mockResolvedValue({ docs: [] })
    mockCountGet.mockResolvedValue({ data: () => ({ count: 0 }) })

    const { GET } = await import('./route')
    const request = new NextRequest('http://localhost/api/users?statusFilter=active')
    await GET(request)

    expect(chainable.where).toHaveBeenCalledWith('isActive', '==', true)
  })

  it('filters by roleFilter', async () => {
    chainable.get.mockResolvedValue({ docs: [] })
    mockCountGet.mockResolvedValue({ data: () => ({ count: 0 }) })

    const { GET } = await import('./route')
    const request = new NextRequest('http://localhost/api/users?roleFilter=admin')
    await GET(request)

    expect(chainable.where).toHaveBeenCalledWith('roles', 'array-contains', 'admin')
  })

  it('returns empty list when no users', async () => {
    chainable.get.mockResolvedValue({ docs: [] })
    mockCountGet.mockResolvedValue({ data: () => ({ count: 0 }) })

    const { GET } = await import('./route')
    const request = new NextRequest('http://localhost/api/users')
    const response = await GET(request)
    const body = await response.json()

    expect(body.users).toHaveLength(0)
    expect(body.nextCursor).toBeNull()
  })

  it('rejects invalid query params', async () => {
    const { GET } = await import('./route')
    const request = new NextRequest('http://localhost/api/users?page=0')
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it('filters by search term in memory', async () => {
    const users = makeDocs([
      { uid: 'u1', displayName: 'Alice Admin', email: 'alice@test.com', isActive: true, roles: ['admin'] },
      { uid: 'u2', displayName: 'Bob User', email: 'bob@test.com', isActive: true, roles: ['cliente'] },
    ])
    chainable.get.mockResolvedValue({ docs: users })

    const { GET } = await import('./route')
    const request = new NextRequest('http://localhost/api/users?search=alice')
    const response = await GET(request)
    const body = await response.json()

    expect(body.users).toHaveLength(1)
    expect(body.users[0].displayName).toBe('Alice Admin')
    expect(body.total).toBe(1)
  })
})
