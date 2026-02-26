import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { userClaimsSchema } from '@/schemas/roleSchema'
import type { UserClaims, UserRole } from '@/types/user'

/**
 * Get custom claims for a user from Firebase Auth.
 * Returns null if no custom claims are set.
 * Uses Zod safeParse for runtime validation (no unsafe casts).
 */
export async function getUserClaims(uid: string): Promise<UserClaims | null> {
  const user = await adminAuth.getUser(uid)
  const claims = user.customClaims as Record<string, unknown> | undefined

  if (!claims || !Array.isArray(claims.roles)) {
    return null
  }

  const parsed = userClaimsSchema.safeParse({
    roles: claims.roles,
    agentId: claims.agentId,
    adminLevel: claims.adminLevel,
  })

  if (!parsed.success) {
    return null
  }

  return parsed.data
}

/**
 * Set custom claims for a user.
 * Ensures 'cliente' is always in the roles array.
 * Syncs claims to JWT first (source of truth), then updates Firestore.
 * Revokes refresh tokens to force immediate re-auth.
 */
export async function setUserClaims(
  uid: string,
  claims: { roles: UserRole[]; agentId?: string }
): Promise<void> {
  // Ensure 'cliente' is always present
  const roles = claims.roles.includes('cliente')
    ? claims.roles
    : ['cliente' as UserRole, ...claims.roles]

  // JWT claims: setCustomUserClaims REPLACES all claims,
  // so omitting agentId effectively removes it
  const customClaims: Record<string, unknown> = { roles }
  if (claims.agentId) {
    customClaims.agentId = claims.agentId
  }

  // Step 1: Set claims in Firebase Auth (source of truth)
  await adminAuth.setCustomUserClaims(uid, customClaims)

  // Step 2: Revoke refresh tokens to force re-auth
  await adminAuth.revokeRefreshTokens(uid)

  // Step 3: Sync roles to Firestore (copy for queries/UI)
  const updateData: Record<string, unknown> = {
    roles,
    updatedAt: FieldValue.serverTimestamp(),
  }
  if (claims.agentId) {
    updateData.agentId = claims.agentId
  } else {
    // Explicitly delete agentId from Firestore when removing agente role
    updateData.agentId = FieldValue.delete()
  }
  await adminDb.doc(`users/${uid}`).update(updateData)
}

/**
 * Initialize claims for a newly registered user if they don't have any.
 * Idempotent: does NOT overwrite existing claims.
 * Uses setUserClaims for consistency (JWT + revoke + Firestore sync).
 */
export async function initUserClaims(uid: string): Promise<void> {
  const existingClaims = await getUserClaims(uid)

  // If claims already exist with roles, do NOT overwrite
  if (existingClaims && existingClaims.roles.length > 0) {
    return
  }

  // Set default claims via setUserClaims for full consistency
  await setUserClaims(uid, { roles: ['cliente'] })
}
