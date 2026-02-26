import { adminDb } from '@/lib/firebase/admin'
import type { UserRole } from '@/types/user'

// Cache is per Cloud Run instance — with minInstances: 1, effective in production
// For scale: migrate to Firestore onSnapshot or Redis
const PERMISSION_CACHE = new Map<string, { data: Record<string, boolean>; expiresAt: number }>()
const PERMISSION_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get expanded permissions for a set of roles.
 * Reads from Firestore /config/permissions/roles/{role} with in-memory cache (TTL 5min).
 * Merges permissions across roles with additive union.
 */
export async function getPermissions(roles: readonly UserRole[]): Promise<Record<string, boolean>> {
  const cacheKey = [...roles].sort().join(',')
  const cached = PERMISSION_CACHE.get(cacheKey)

  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }

  // Parallel Firestore reads for all roles
  const rolePermsList = await Promise.all(roles.map((role) => getRolePermissions(role)))

  const merged: Record<string, boolean> = {}

  for (const rolePerms of rolePermsList) {
    for (const [key, value] of Object.entries(rolePerms)) {
      // Additive union: if ANY role has the permission, result is true
      if (value === true) {
        merged[key] = true
      } else if (merged[key] === undefined) {
        merged[key] = false
      }
    }
  }

  PERMISSION_CACHE.set(cacheKey, { data: merged, expiresAt: Date.now() + PERMISSION_CACHE_TTL })
  return merged
}

/**
 * Check if a set of roles has a specific permission.
 */
export async function hasPermission(roles: readonly UserRole[], permission: string): Promise<boolean> {
  const permissions = await getPermissions(roles)
  return permissions[permission] === true
}

/**
 * Clear the permission cache. Useful after permission updates.
 */
export function clearPermissionCache(): void {
  PERMISSION_CACHE.clear()
}

async function getRolePermissions(role: UserRole): Promise<Record<string, boolean>> {
  const roleCacheKey = `__role__${role}`
  const cached = PERMISSION_CACHE.get(roleCacheKey)

  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }

  // Path: /config/permissions/roles/{role} — consistent with seedPermissions.ts
  const doc = await adminDb.doc(`config/permissions/roles/${role}`).get()

  if (!doc.exists) {
    return {}
  }

  const data = doc.data() as Record<string, unknown>
  const permissions: Record<string, boolean> = {}

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'boolean') {
      permissions[key] = value
    }
  }

  PERMISSION_CACHE.set(roleCacheKey, { data: permissions, expiresAt: Date.now() + PERMISSION_CACHE_TTL })
  return permissions
}
