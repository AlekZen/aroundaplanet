import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebase/admin'
import { AppError } from '@/lib/errors/AppError'
import { userClaimsSchema } from '@/schemas/roleSchema'
import type { UserRole } from '@/types/user'

export interface AuthClaims {
  uid: string
  roles: UserRole[]
  agentId?: string
}

export async function requireAuth(): Promise<AuthClaims> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('__session')?.value

  if (!sessionCookie) {
    throw new AppError('AUTH_REQUIRED', 'Sesion requerida', 401, false)
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    const parsed = userClaimsSchema.safeParse({
      roles: decoded.roles,
      agentId: decoded.agentId,
    })

    if (!parsed.success) {
      return { uid: decoded.uid, roles: ['cliente'], agentId: undefined }
    }

    return {
      uid: decoded.uid,
      roles: parsed.data.roles,
      agentId: parsed.data.agentId,
    }
  } catch {
    throw new AppError('AUTH_SESSION_EXPIRED', 'Sesion expirada o revocada', 401, false)
  }
}
