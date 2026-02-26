import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { userStatusUpdateSchema } from '@/schemas/userManagementSchema'

/**
 * PATCH /api/users/[uid]/status — Activate or deactivate a user
 * Requires 'users:manage' permission.
 * On deactivation: revokes refresh tokens and writes audit log.
 * On activation: writes audit log only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const caller = await requirePermission('users:manage')

    const { uid } = await params

    // Validate request body
    const body = await request.json()
    const parsed = userStatusUpdateSchema.safeParse(body)

    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Cuerpo de solicitud invalido',
        400,
        false
      )
    }

    const { isActive, reason } = parsed.data

    // Prevent self-deactivation
    if (!isActive && caller.uid === uid) {
      throw new AppError(
        'USER_SELF_DEACTIVATION',
        'No puedes desactivarte a ti mismo',
        400,
        false
      )
    }

    // Verify user exists
    const userRef = adminDb.collection('users').doc(uid)
    const userDoc = await userRef.get()

    if (!userDoc.exists) {
      throw new AppError('USER_NOT_FOUND', 'Usuario no encontrado', 404, false)
    }

    const previousStatus = userDoc.data()?.isActive as boolean | undefined

    // Revoke refresh tokens BEFORE Firestore update (if revoke fails, no state change)
    if (!isActive) {
      await adminAuth.revokeRefreshTokens(uid)
    }

    // Update user status
    await userRef.update({ isActive })

    // Write audit log
    await adminDb.collection('auditLog').add({
      action: isActive ? 'user.activated' : 'user.deactivated',
      targetUid: uid,
      performedBy: caller.uid,
      timestamp: Timestamp.now(),
      details: {
        ...(reason !== undefined && { reason }),
        previousStatus: previousStatus ?? null,
        newStatus: isActive,
      },
    })

    return NextResponse.json({ isActive })
  } catch (error) {
    return handleApiError(error)
  }
}
