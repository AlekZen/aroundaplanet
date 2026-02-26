import { z } from 'zod'
import { VALID_ROLES } from '@/config/roles'

export const userClaimsSchema = z.object({
  roles: z.array(z.enum(VALID_ROLES)).min(1),
  agentId: z.string().optional(),
  adminLevel: z.number().optional(),
})

export const setRolesSchema = z.object({
  uid: z.string().min(1, 'uid es requerido'),
  roles: z.array(z.enum(VALID_ROLES)).min(1, 'Al menos un rol es requerido'),
  agentId: z.string().optional(),
}).refine(
  (data) => {
    if (data.roles.includes('agente') && !data.agentId) return false
    if (!data.roles.includes('agente') && data.agentId) return false
    return true
  },
  { message: 'agentId es requerido si y solo si el rol agente esta presente' }
).refine(
  (data) => data.roles.includes('cliente'),
  { message: 'El rol cliente debe estar siempre presente' }
)

export type SetRolesInput = z.infer<typeof setRolesSchema>
export type UserClaimsInput = z.infer<typeof userClaimsSchema>
