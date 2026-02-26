import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
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

    const { uid, roles, agentId } = parsed.data

    // Validate agentId exists in Firestore if provided
    // NOTE: `agents` collection will be created in Story 2.1a (Trip Sync Odoo→Firestore)
    if (agentId) {
      const agentDoc = await adminDb.doc(`agents/${agentId}`).get()
      if (!agentDoc.exists) {
        return NextResponse.json(
          { code: 'AGENT_NOT_FOUND', message: 'El agentId no existe en el sistema', retryable: false },
          { status: 400 }
        )
      }
    }

    // Set claims (includes revokeRefreshTokens and Firestore sync)
    await setUserClaims(uid, { roles, agentId })

    // Invalidate permission cache after role change
    clearPermissionCache()

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json(
      { code: 'CLAIMS_UPDATE_FAILED', message: 'Error al actualizar claims', retryable: true },
      { status: 500 }
    )
  }
}
