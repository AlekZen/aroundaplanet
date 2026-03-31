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

/** Color class for role badges (Tailwind classes) */
export const ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
  superadmin: { bg: 'bg-purple-100', text: 'text-purple-800' },
  director: { bg: 'bg-blue-100', text: 'text-blue-800' },
  admin: { bg: 'bg-green-100', text: 'text-green-800' },
  agente: { bg: 'bg-orange-100', text: 'text-orange-800' },
  cliente: { bg: 'bg-gray-100', text: 'text-gray-600' },
}

/** Human-readable display labels per role */
export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'SuperAdmin',
  director: 'Director',
  admin: 'Admin',
  agente: 'Agente',
  cliente: 'Cliente',
}

/** Lucide icon name per role */
export const ROLE_ICONS: Record<UserRole, string> = {
  superadmin: 'Shield',
  director: 'BarChart3',
  admin: 'Settings',
  agente: 'Briefcase',
  cliente: 'User',
}

export const ROLE_NAVIGATION_MAP: Record<UserRole, RoleNavItem[]> = {
  cliente: [
    { role: 'cliente', label: 'Mis Viajes', href: '/client/my-trips', priority: 1 },
    { role: 'cliente', label: 'Explorar Viajes', href: '/viajes', priority: 1 },
    { role: 'cliente', label: 'Perfil', href: '/client/profile', priority: 1 },
  ],
  agente: [
    { role: 'agente', label: 'Mi Portal', href: '/agent/dashboard', priority: 2 },
    { role: 'agente', label: 'Mis Clientes', href: '/agent/clients', priority: 2 },
    { role: 'agente', label: 'Perfil', href: '/agent/profile', priority: 2 },
  ],
  admin: [
    { role: 'admin', label: 'Panel Admin', href: '/admin/dashboard', priority: 3 },
  ],
  director: [
    { role: 'director', label: 'Dashboard BI', href: '/director/dashboard', priority: 4 },
  ],
  superadmin: [
    { role: 'superadmin', label: 'Gestion', href: '/superadmin/users', priority: 5 },
  ],
}
