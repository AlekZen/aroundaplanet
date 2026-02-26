import { describe, it, expect } from 'vitest'
import { setRolesSchema, userClaimsSchema } from './roleSchema'

describe('roleSchema', () => {
  describe('setRolesSchema', () => {
    it('accepts valid roles with cliente', () => {
      const result = setRolesSchema.safeParse({
        uid: 'user123',
        roles: ['cliente', 'agente'],
        agentId: 'agent456',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing uid', () => {
      const result = setRolesSchema.safeParse({
        uid: '',
        roles: ['cliente'],
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid role values', () => {
      const result = setRolesSchema.safeParse({
        uid: 'user123',
        roles: ['cliente', 'invalid_role'],
      })
      expect(result.success).toBe(false)
    })

    it('requires agentId when agente role is present', () => {
      const result = setRolesSchema.safeParse({
        uid: 'user123',
        roles: ['cliente', 'agente'],
      })
      expect(result.success).toBe(false)
    })

    it('rejects agentId when agente role is absent', () => {
      const result = setRolesSchema.safeParse({
        uid: 'user123',
        roles: ['cliente', 'admin'],
        agentId: 'agent456',
      })
      expect(result.success).toBe(false)
    })

    it('requires cliente role to always be present', () => {
      const result = setRolesSchema.safeParse({
        uid: 'user123',
        roles: ['admin'],
      })
      expect(result.success).toBe(false)
    })

    it('accepts superadmin with cliente', () => {
      const result = setRolesSchema.safeParse({
        uid: 'user123',
        roles: ['cliente', 'superadmin'],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('userClaimsSchema', () => {
    it('accepts valid claims', () => {
      const result = userClaimsSchema.safeParse({
        roles: ['cliente'],
        agentId: 'agent123',
        adminLevel: 3,
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty roles array', () => {
      const result = userClaimsSchema.safeParse({
        roles: [],
      })
      expect(result.success).toBe(false)
    })
  })
})
