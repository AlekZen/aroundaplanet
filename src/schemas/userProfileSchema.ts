import { z } from 'zod'
import { VALID_ROLES } from '@/config/roles'

export const userProfileSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  photoURL: z.string().nullable(),
  roles: z.array(z.enum(VALID_ROLES)),
  agentId: z.string().optional(),
  isActive: z.boolean(),
  provider: z.enum(['email', 'google']),
  createdAt: z.any(),
  updatedAt: z.any(),
  lastLoginAt: z.any(),
}).refine(
  (data) => {
    if (data.roles.includes('agente') && !data.agentId) return false
    if (!data.roles.includes('agente') && data.agentId) return false
    return true
  },
  { message: 'agentId es requerido si y solo si el usuario tiene rol agente' }
)
