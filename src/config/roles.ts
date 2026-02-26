import type { UserRole } from '@/types/user'

export const USER_ROLES: readonly UserRole[] = [
  'cliente',
  'agente',
  'admin',
  'director',
  'superadmin',
] as const

export const DEFAULT_ROLE: UserRole = 'cliente'

export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  cliente: '/dashboard',
  agente: '/dashboard',
  admin: '/dashboard',
  director: '/dashboard',
  superadmin: '/dashboard',
}
