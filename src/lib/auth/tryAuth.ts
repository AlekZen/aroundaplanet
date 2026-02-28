import { requireAuth } from './requireAuth'
import type { AuthClaims } from './requireAuth'

export type { AuthClaims }

/** Optional auth — returns claims if authenticated, null otherwise. Never throws. */
export async function tryAuth(): Promise<AuthClaims | null> {
  try {
    return await requireAuth()
  } catch {
    return null
  }
}
