import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()
const mockDoc = vi.fn(() => ({ get: mockGet }))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    doc: mockDoc,
  },
}))

describe('permissions', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockGet.mockReset()
    // Clear the in-memory cache before each test
    const { clearPermissionCache } = await import('./permissions')
    clearPermissionCache()
  })

  it('getPermissions reads from Firestore using direct path', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        'trips:read': true,
        'trips:write': false,
        'payments:verify': false,
      }),
    })

    const { getPermissions } = await import('./permissions')
    const perms = await getPermissions(['cliente'])

    // Uses direct path consistent with seedPermissions.ts
    expect(mockDoc).toHaveBeenCalledWith('config/permissions/roles/cliente')
    expect(perms['trips:read']).toBe(true)
    expect(perms['trips:write']).toBe(false)
  })

  it('getPermissions merges multi-role with additive union (parallel reads)', async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          'trips:read': true,
          'trips:write': false,
          'payments:verify': false,
        }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          'trips:read': true,
          'trips:write': true,
          'payments:verify': true,
        }),
      })

    const { getPermissions } = await import('./permissions')
    const perms = await getPermissions(['cliente', 'admin'])

    // Additive: admin has trips:write=true, so merged result is true
    expect(perms['trips:write']).toBe(true)
    expect(perms['payments:verify']).toBe(true)
    expect(perms['trips:read']).toBe(true)
  })

  it('getPermissions returns cached result on second call', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ 'trips:read': true }),
    })

    const { getPermissions } = await import('./permissions')
    await getPermissions(['cliente'])

    // Reset mock to verify it's not called again
    mockGet.mockClear()

    const perms2 = await getPermissions(['cliente'])
    expect(mockGet).not.toHaveBeenCalled()
    expect(perms2['trips:read']).toBe(true)
  })

  it('getPermissions returns empty object for non-existent role', async () => {
    mockGet.mockResolvedValue({ exists: false })

    const { getPermissions } = await import('./permissions')
    const perms = await getPermissions(['cliente'])

    expect(perms).toEqual({})
  })

  it('hasPermission returns true for granted permission', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ 'payments:verify': true }),
    })

    const { hasPermission } = await import('./permissions')
    const result = await hasPermission(['admin'], 'payments:verify')

    expect(result).toBe(true)
  })

  it('hasPermission returns false for denied permission', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ 'payments:verify': false }),
    })

    const { hasPermission } = await import('./permissions')
    const result = await hasPermission(['cliente'], 'payments:verify')

    expect(result).toBe(false)
  })

  it('clearPermissionCache forces fresh Firestore reads', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ 'trips:read': true }),
    })

    const { getPermissions, clearPermissionCache } = await import('./permissions')
    await getPermissions(['cliente'])

    mockGet.mockClear()
    clearPermissionCache()

    // Now it should read from Firestore again
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ 'trips:read': false }),
    })

    const perms = await getPermissions(['cliente'])
    expect(mockGet).toHaveBeenCalled()
    expect(perms['trips:read']).toBe(false)
  })
})
