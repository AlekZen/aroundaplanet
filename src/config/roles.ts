import type { UserRole } from '@/types/user'

/** Const tuple — source of truth for Zod schemas and runtime checks */
export const VALID_ROLES = ['cliente', 'agente', 'admin', 'director', 'superadmin'] as const

export const USER_ROLES: readonly UserRole[] = [...VALID_ROLES]

export const DEFAULT_ROLE: UserRole = 'cliente'

/** Roles that can override agent isolation (read any agent's data) */
export const AGENT_OVERRIDE_ROLES: readonly UserRole[] = ['admin', 'director', 'superadmin']

export const ROLE_PRIORITY: Record<UserRole, number> = {
  superadmin: 5,
  director: 4,
  admin: 3,
  agente: 2,
  cliente: 1,
}

export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  cliente: '/client/my-trips',
  agente: '/agent/dashboard',
  admin: '/admin/dashboard',
  director: '/director/dashboard',
  superadmin: '/superadmin/users',
}

export interface RoleNavItem {
  role: UserRole
  label: string
  href: string
  priority: number
}

export const ROLE_NAVIGATION_MAP: Record<UserRole, RoleNavItem[]> = {
  cliente: [
    { role: 'cliente', label: 'Mis Viajes', href: '/client/my-trips', priority: 1 },
  ],
  agente: [
    { role: 'agente', label: 'Mi Portal', href: '/agent/dashboard', priority: 2 },
    { role: 'agente', label: 'Mis Clientes', href: '/agent/clients', priority: 2 },
  ],
  admin: [
    { role: 'admin', label: 'Admin', href: '/admin/dashboard', priority: 3 },
  ],
  director: [
    { role: 'director', label: 'Dashboard BI', href: '/director/dashboard', priority: 4 },
  ],
  superadmin: [
    { role: 'superadmin', label: 'Gestion', href: '/superadmin/users', priority: 5 },
  ],
}
