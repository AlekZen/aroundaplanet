import { requireAuth, type AuthClaims } from './requireAuth'
import { hasPermission } from './permissions'
import { AppError } from '@/lib/errors/AppError'

export async function requirePermission(permission: string): Promise<AuthClaims> {
  const claims = await requireAuth()
  const allowed = await hasPermission(claims.roles, permission)

  if (!allowed) {
    throw new AppError('INSUFFICIENT_PERMISSION', `Permiso ${permission} requerido`, 403, false)
  }

  return claims
}
