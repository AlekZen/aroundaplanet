import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockSetCustomUserClaims = vi.fn()
const mockRevokeRefreshTokens = vi.fn()
const mockDocUpdate = vi.fn()
const mockDoc = vi.fn(() => ({ update: mockDocUpdate }))
const mockFieldValueDelete = vi.fn(() => '__FIELD_DELETE__')
const mockFieldValueServerTimestamp = vi.fn(() => '__SERVER_TIMESTAMP__')

vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: {
    getUser: mockGetUser,
    setCustomUserClaims: mockSetCustomUserClaims,
    revokeRefreshTokens: mockRevokeRefreshTokens,
  },
  adminDb: {
    doc: mockDoc,
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    delete: mockFieldValueDelete,
    serverTimestamp: mockFieldValueServerTimestamp,
  },
}))

describe('claims', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockReset()
    mockSetCustomUserClaims.mockReset()
    mockRevokeRefreshTokens.mockReset()
    mockDocUpdate.mockReset()
  })

  describe('getUserClaims', () => {
    it('returns claims when user has valid roles (Zod validated)', async () => {
      mockGetUser.mockResolvedValue({
        customClaims: { roles: ['cliente', 'admin'], agentId: undefined },
      })

      const { getUserClaims } = await import('./claims')
      const result = await getUserClaims('user123')

      expect(mockGetUser).toHaveBeenCalledWith('user123')
      expect(result).toEqual({
        roles: ['cliente', 'admin'],
        agentId: undefined,
        adminLevel: undefined,
      })
    })

    it('returns null when no custom claims exist', async () => {
      mockGetUser.mockResolvedValue({ customClaims: undefined })

      const { getUserClaims } = await import('./claims')
      const result = await getUserClaims('user123')

      expect(result).toBeNull()
    })

    it('returns null when roles is not an array', async () => {
      mockGetUser.mockResolvedValue({ customClaims: { roles: 'not-array' } })

      const { getUserClaims } = await import('./claims')
      const result = await getUserClaims('user123')

      expect(result).toBeNull()
    })

    it('returns null when roles contain invalid values (Zod rejects)', async () => {
      mockGetUser.mockResolvedValue({
        customClaims: { roles: ['cliente', 'invented_role'] },
      })

      const { getUserClaims } = await import('./claims')
      const result = await getUserClaims('user123')

      expect(result).toBeNull()
    })

    it('includes agentId and adminLevel when present', async () => {
      mockGetUser.mockResolvedValue({
        customClaims: { roles: ['cliente', 'agente'], agentId: 'a1', adminLevel: 2 },
      })

      const { getUserClaims } = await import('./claims')
      const result = await getUserClaims('user123')

      expect(result).toEqual({
        roles: ['cliente', 'agente'],
        agentId: 'a1',
        adminLevel: 2,
      })
    })
  })

  describe('setUserClaims', () => {
    it('ensures cliente is always present in roles', async () => {
      mockSetCustomUserClaims.mockResolvedValue(undefined)
      mockRevokeRefreshTokens.mockResolvedValue(undefined)
      mockDocUpdate.mockResolvedValue(undefined)

      const { setUserClaims } = await import('./claims')
      await setUserClaims('user123', { roles: ['admin'] })

      expect(mockSetCustomUserClaims).toHaveBeenCalledWith('user123', {
        roles: ['cliente', 'admin'],
      })
    })

    it('does not duplicate cliente if already present', async () => {
      mockSetCustomUserClaims.mockResolvedValue(undefined)
      mockRevokeRefreshTokens.mockResolvedValue(undefined)
      mockDocUpdate.mockResolvedValue(undefined)

      const { setUserClaims } = await import('./claims')
      await setUserClaims('user123', { roles: ['cliente', 'admin'] })

      expect(mockSetCustomUserClaims).toHaveBeenCalledWith('user123', {
        roles: ['cliente', 'admin'],
      })
    })

    it('calls revokeRefreshTokens after setting claims', async () => {
      mockSetCustomUserClaims.mockResolvedValue(undefined)
      mockRevokeRefreshTokens.mockResolvedValue(undefined)
      mockDocUpdate.mockResolvedValue(undefined)

      const { setUserClaims } = await import('./claims')
      await setUserClaims('user123', { roles: ['cliente'] })

      expect(mockRevokeRefreshTokens).toHaveBeenCalledWith('user123')
    })

    it('includes agentId in JWT claims when provided', async () => {
      mockSetCustomUserClaims.mockResolvedValue(undefined)
      mockRevokeRefreshTokens.mockResolvedValue(undefined)
      mockDocUpdate.mockResolvedValue(undefined)

      const { setUserClaims } = await import('./claims')
      await setUserClaims('user123', {
        roles: ['cliente', 'agente'],
        agentId: 'agent456',
      })

      expect(mockSetCustomUserClaims).toHaveBeenCalledWith('user123', {
        roles: ['cliente', 'agente'],
        agentId: 'agent456',
      })
    })

    it('syncs roles + updatedAt to Firestore', async () => {
      mockSetCustomUserClaims.mockResolvedValue(undefined)
      mockRevokeRefreshTokens.mockResolvedValue(undefined)
      mockDocUpdate.mockResolvedValue(undefined)

      const { setUserClaims } = await import('./claims')
      await setUserClaims('user123', { roles: ['cliente', 'admin'] })

      expect(mockDoc).toHaveBeenCalledWith('users/user123')
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          roles: ['cliente', 'admin'],
          updatedAt: '__SERVER_TIMESTAMP__',
          agentId: '__FIELD_DELETE__',
        })
      )
    })

    it('syncs agentId to Firestore when provided', async () => {
      mockSetCustomUserClaims.mockResolvedValue(undefined)
      mockRevokeRefreshTokens.mockResolvedValue(undefined)
      mockDocUpdate.mockResolvedValue(undefined)

      const { setUserClaims } = await import('./claims')
      await setUserClaims('user123', {
        roles: ['cliente', 'agente'],
        agentId: 'agent456',
      })

      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          roles: ['cliente', 'agente'],
          agentId: 'agent456',
          updatedAt: '__SERVER_TIMESTAMP__',
        })
      )
    })

    it('deletes agentId from Firestore when not provided', async () => {
      mockSetCustomUserClaims.mockResolvedValue(undefined)
      mockRevokeRefreshTokens.mockResolvedValue(undefined)
      mockDocUpdate.mockResolvedValue(undefined)

      const { setUserClaims } = await import('./claims')
      await setUserClaims('user123', { roles: ['cliente', 'admin'] })

      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: '__FIELD_DELETE__',
        })
      )
    })

    it('propagates error when revokeRefreshTokens fails', async () => {
      mockSetCustomUserClaims.mockResolvedValue(undefined)
      mockRevokeRefreshTokens.mockRejectedValue(new Error('Revoke failed'))

      const { setUserClaims } = await import('./claims')
      await expect(setUserClaims('user123', { roles: ['cliente'] })).rejects.toThrow('Revoke failed')
    })

    it('propagates error when Firestore update fails', async () => {
      mockSetCustomUserClaims.mockResolvedValue(undefined)
      mockRevokeRefreshTokens.mockResolvedValue(undefined)
      mockDocUpdate.mockRejectedValue(new Error('Firestore unavailable'))

      const { setUserClaims } = await import('./claims')
      await expect(setUserClaims('user123', { roles: ['cliente'] })).rejects.toThrow('Firestore unavailable')
    })
  })

  describe('initUserClaims', () => {
    it('calls setUserClaims when user has no claims', async () => {
      mockGetUser.mockResolvedValue({ customClaims: undefined })
      mockSetCustomUserClaims.mockResolvedValue(undefined)
      mockRevokeRefreshTokens.mockResolvedValue(undefined)
      mockDocUpdate.mockResolvedValue(undefined)

      const { initUserClaims } = await import('./claims')
      await initUserClaims('newuser123')

      // Uses setUserClaims which sets JWT + revokes + syncs Firestore
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith('newuser123', {
        roles: ['cliente'],
      })
      expect(mockRevokeRefreshTokens).toHaveBeenCalledWith('newuser123')
      expect(mockDocUpdate).toHaveBeenCalled()
    })

    it('does NOT overwrite existing claims (idempotent)', async () => {
      mockGetUser.mockResolvedValue({
        customClaims: { roles: ['cliente', 'agente'] },
      })

      const { initUserClaims } = await import('./claims')
      await initUserClaims('existinguser')

      expect(mockSetCustomUserClaims).not.toHaveBeenCalled()
    })
  })
})
