import { describe, it, expect, vi } from 'vitest'
import { PERMISSION_MATRIX, runSeed } from './seedPermissions'
import type { UserRole } from '@/types/user'

describe('seedPermissions', () => {
  describe('PERMISSION_MATRIX', () => {
    const ALL_ROLES: UserRole[] = ['cliente', 'agente', 'admin', 'director', 'superadmin']

    it('defines permissions for all 5 roles', () => {
      expect(Object.keys(PERMISSION_MATRIX)).toEqual(ALL_ROLES)
    })

    it('all roles share the same permission keys (21 permissions)', () => {
      const baseKeys = Object.keys(PERMISSION_MATRIX.cliente).sort()
      expect(baseKeys).toHaveLength(21)

      for (const role of ALL_ROLES) {
        const roleKeys = Object.keys(PERMISSION_MATRIX[role]).sort()
        expect(roleKeys).toEqual(baseKeys)
      }
    })

    it('all permission values are booleans', () => {
      for (const role of ALL_ROLES) {
        for (const [key, value] of Object.entries(PERMISSION_MATRIX[role])) {
          expect(typeof value).toBe('boolean')
          // Just reference key to avoid unused variable lint
          expect(key).toBeTruthy()
        }
      }
    })

    it('superadmin has all critical permissions enabled', () => {
      const superPerms = PERMISSION_MATRIX.superadmin
      expect(superPerms['users:manage']).toBe(true)
      expect(superPerms['config:manage']).toBe(true)
      expect(superPerms['sync:odoo']).toBe(true)
      expect(superPerms['payments:verify']).toBe(true)
    })

    it('cliente has minimal permissions', () => {
      const clientePerms = PERMISSION_MATRIX.cliente
      expect(clientePerms['trips:read']).toBe(true)
      expect(clientePerms['orders:readOwn']).toBe(true)
      expect(clientePerms['trips:write']).toBe(false)
      expect(clientePerms['users:manage']).toBe(false)
      expect(clientePerms['config:manage']).toBe(false)
    })

    it('agente has referrals:create and clients:readOwn', () => {
      const agentePerms = PERMISSION_MATRIX.agente
      expect(agentePerms['referrals:create']).toBe(true)
      expect(agentePerms['clients:readOwn']).toBe(true)
      expect(agentePerms['commissions:readOwn']).toBe(true)
    })
  })

  describe('runSeed', () => {
    it('writes all 5 roles to Firestore with merge', async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined)
      const mockDbDoc = vi.fn(() => ({ set: mockSet }))
      const mockDb = { doc: mockDbDoc } as unknown as FirebaseFirestore.Firestore

      await runSeed(mockDb)

      expect(mockDbDoc).toHaveBeenCalledTimes(5)
      expect(mockDbDoc).toHaveBeenCalledWith('config/permissions/roles/cliente')
      expect(mockDbDoc).toHaveBeenCalledWith('config/permissions/roles/agente')
      expect(mockDbDoc).toHaveBeenCalledWith('config/permissions/roles/admin')
      expect(mockDbDoc).toHaveBeenCalledWith('config/permissions/roles/director')
      expect(mockDbDoc).toHaveBeenCalledWith('config/permissions/roles/superadmin')

      expect(mockSet).toHaveBeenCalledTimes(5)
      // All calls use merge: true (idempotent)
      for (const call of mockSet.mock.calls) {
        expect(call[1]).toEqual({ merge: true })
      }
    })

    it('writes correct permission data for each role', async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined)
      const mockDbDoc = vi.fn(() => ({ set: mockSet }))
      const mockDb = { doc: mockDbDoc } as unknown as FirebaseFirestore.Firestore

      await runSeed(mockDb)

      // Verify cliente permissions were passed
      const clienteCall = mockSet.mock.calls[0]
      expect(clienteCall[0]).toEqual(PERMISSION_MATRIX.cliente)

      // Verify superadmin permissions were passed
      const superadminCall = mockSet.mock.calls[4]
      expect(superadminCall[0]).toEqual(PERMISSION_MATRIX.superadmin)
    })
  })
})
