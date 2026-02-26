import { useAuthStore } from '@/stores/useAuthStore'
import { ROLE_NAVIGATION_MAP, ROLE_PRIORITY } from '@/config/roles'
import type { RoleNavItem } from '@/config/roles'

export function useRoleNavigation(): RoleNavItem[] {
  const claims = useAuthStore((s) => s.claims)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (!isAuthenticated || !claims) {
    return []
  }

  const roles = claims.roles
  const items: RoleNavItem[] = []

  for (const role of roles) {
    const roleItems = ROLE_NAVIGATION_MAP[role]
    if (roleItems) {
      items.push(...roleItems)
    }
  }

  // Ordenar por prioridad descendente (mayor privilegio primero)
  items.sort((a, b) => ROLE_PRIORITY[b.role] - ROLE_PRIORITY[a.role])

  return items
}
