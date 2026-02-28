import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRequireAuth } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
}))

vi.mock('./requireAuth', () => ({
  requireAuth: mockRequireAuth,
}))

import { tryAuth } from './tryAuth'

describe('tryAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns claims when authenticated', async () => {
    const claims = { uid: 'user-1', roles: ['cliente'] }
    mockRequireAuth.mockResolvedValue(claims)

    const result = await tryAuth()
    expect(result).toEqual(claims)
  })

  it('returns null when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('AUTH_REQUIRED'))

    const result = await tryAuth()
    expect(result).toBeNull()
  })
})
