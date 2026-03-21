import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { getUserClaims, setUserClaims } from '@/lib/auth/claims'
import { clearPermissionCache } from '@/lib/auth/permissions'
import { setRolesSchema } from '@/schemas/roleSchema'

/**
 * GET /api/auth/claims — returns current user's claims
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('__session')?.value

    if (!sessionCookie) {
      return NextResponse.json(
        { code: 'AUTH_REQUIRED', message: 'Sesion requerida', retryable: false },
        { status: 401 }
      )
    }

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    const claims = await getUserClaims(decoded.uid)

    return NextResponse.json(claims ?? { roles: ['cliente'] })
  } catch {
    return NextResponse.json(
      { code: 'AUTH_INVALID_TOKEN', message: 'Sesion invalida o expirada', retryable: false },
      { status: 401 }
    )
  }
}

/**
 * POST /api/auth/claims — SuperAdmin sets claims for a target user
 * Body: { uid: string, roles: string[], agentId?: string }
 */
export async function POST(request: Request) {
  try {
    // Verify caller is superadmin via session cookie
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('__session')?.value

    if (!sessionCookie) {
      return NextResponse.json(
        { code: 'AUTH_REQUIRED', message: 'Sesion requerida', retryable: false },
        { status: 401 }
      )
    }

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    // Safe role check: Array.isArray guard instead of unsafe cast
    const callerRoles = Array.isArray(decoded.roles) ? (decoded.roles as string[]) : undefined

    if (!callerRoles?.includes('superadmin')) {
      return NextResponse.json(
        { code: 'INSUFFICIENT_ROLE', message: 'Se requiere rol superadmin', retryable: false },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const parsed = setRolesSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'INVALID_ROLE', message: parsed.error.issues[0]?.message ?? 'Datos invalidos', retryable: false },
        { status: 400 }
      )
    }

    const { uid, roles, agentId, odooTeamId } = parsed.data

    // Bootstrap agents/{agentId} document if assigning agente role.
    // This document is the root for agent-scoped subcollections (clients, commissions, etc.)
    // and is required by Firestore security rules for agent isolation.
    if (agentId && roles.includes('agente')) {
      const agentDoc = await adminDb.doc(`agents/${agentId}`).get()
      if (!agentDoc.exists) {
        const now = Timestamp.now()
        await adminDb.doc(`agents/${agentId}`).set({
          uid: uid,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    // Set claims. When the superadmin edits their OWN roles, skip token
    // revocation to avoid invalidating their current session cookie.
    const isSelfEdit = decoded.uid === uid
    await setUserClaims(uid, { roles, agentId }, { skipRevoke: isSelfEdit })

    // Save odooTeamId to user profile if provided (links platform user to Odoo agent)
    if (odooTeamId !== undefined) {
      await adminDb.doc(`users/${uid}`).update({ odooTeamId })
    }

    // Invalidate permission cache after role change
    clearPermissionCache()

    // For self-edits: tell the client to refresh its ID token so the
    // new claims (e.g. agentId) propagate to the Zustand store and
    // a fresh session cookie is created.
    if (isSelfEdit) {
      return NextResponse.json({ refreshRequired: true })
    }

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json(
      { code: 'CLAIMS_UPDATE_FAILED', message: 'Error al actualizar claims', retryable: true },
      { status: 500 }
    )
  }
}
