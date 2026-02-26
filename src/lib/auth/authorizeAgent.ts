import { AppError } from '@/lib/errors/AppError'
import { AGENT_OVERRIDE_ROLES } from '@/config/roles'

export function authorizeAgent(
  callerAgentId: string | undefined,
  callerRoles: string[],
  requestedAgentId: string
): void {
  // Admin/Director/SuperAdmin can read any agent's data
  if (callerRoles.some((role) => AGENT_OVERRIDE_ROLES.includes(role as never))) {
    return
  }

  // Agent can only access their own data
  if (callerAgentId === requestedAgentId) {
    return
  }

  throw new AppError(
    'AGENT_ISOLATION_VIOLATION',
    'No tienes acceso a datos de otro agente',
    403,
    false
  )
}
