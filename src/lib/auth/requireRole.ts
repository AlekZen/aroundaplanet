import type { UserRole } from '@/types/user'
import { requireAuth, type AuthClaims } from './requireAuth'
import { AppError } from '@/lib/errors/AppError'

export async function requireRole(role: UserRole): Promise<AuthClaims> {
  const claims = await requireAuth()

  if (!claims.roles.includes(role)) {
    throw new AppError('INSUFFICIENT_ROLE', `Se requiere rol ${role}`, 403, false)
  }

  return claims
}
