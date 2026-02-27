import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { profileUpdateSchema } from '@/schemas/profileSchema'

/**
 * PATCH /api/users/[uid]/profile — Update user profile sections
 * Owner can update own profile. Admin/SuperAdmin can update any user.
 * bankData section restricted to users with role 'agente'.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const caller = await requireAuth()
    const { uid } = await params

    // Authorization: owner or users:manage permission
    if (caller.uid !== uid) {
      await requirePermission('users:manage')
    }

    const body = await request.json()
    const parsed = profileUpdateSchema.safeParse(body)

    if (!parsed.success) {
      throw new AppError(
        'PROFILE_VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Datos de perfil invalidos',
        400,
        false
      )
    }

    const { section, data } = parsed.data

    // Verify user exists before any update
    const userDoc = await adminDb.collection('users').doc(uid).get()
    if (!userDoc.exists) {
      throw new AppError('USER_NOT_FOUND', 'Usuario no encontrado', 404, false)
    }

    // Bank data restricted to agents
    if (section === 'bank') {
      const userData = userDoc.data()
      const roles = (userData?.roles as string[]) ?? []
      if (!roles.includes('agente')) {
        throw new AppError(
          'BANK_DATA_AGENTS_ONLY',
          'Solo agentes pueden actualizar datos bancarios',
          403,
          false
        )
      }
    }

    // Build Firestore update object
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (section === 'personal') {
      updateData.firstName = data.firstName
      updateData.lastName = data.lastName
      updateData.displayName = `${data.firstName} ${data.lastName}`
      if (data.phone !== undefined) {
        updateData.phone = data.phone || null
      }
    } else if (section === 'fiscal') {
      updateData.fiscalData = data
    } else if (section === 'bank') {
      updateData.bankData = data
    }

    await adminDb.collection('users').doc(uid).update(updateData)

    // Exclude serverTimestamp sentinel from response (not JSON-serializable)
    const { updatedAt: _ts, ...responseFields } = updateData
    return NextResponse.json({ updatedFields: responseFields, updatedAt: new Date().toISOString() })
  } catch (error) {
    return handleApiError(error)
  }
}
