import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { notificationPreferencesSchema } from '@/schemas/notificationPreferencesSchema'
import { DEFAULT_NOTIFICATION_PREFERENCES, ROLE_NOTIFICATION_CATEGORIES, type NotificationCategoryKey } from '@/config/notifications'
import type { UserRole, NotificationPreferences } from '@/types/user'

function mergeWithDefaults(
  existing: Partial<NotificationPreferences> | undefined,
  roles: UserRole[]
): NotificationPreferences {
  const base = { ...DEFAULT_NOTIFICATION_PREFERENCES }

  // Merge existing prefs over defaults
  if (existing) {
    if (existing.categories) base.categories = { ...base.categories, ...existing.categories }
    if (existing.quietHours) base.quietHours = { ...base.quietHours, ...existing.quietHours }
    if (existing.channels) base.channels = { ...base.channels, ...existing.channels }
    if (existing.timezone) base.timezone = existing.timezone
  }

  // Filter categories to only those available for user's roles
  const allowedCategories = new Set(
    roles.flatMap((role) => ROLE_NOTIFICATION_CATEGORIES[role] ?? [])
  )
  const filteredCategories: Record<string, boolean> = {}
  for (const key of allowedCategories) {
    filteredCategories[key] = base.categories[key] ?? true
  }
  base.categories = filteredCategories

  return base
}

/**
 * GET /api/users/[uid]/preferences — Read notification preferences
 * Owner or admin/superadmin can read.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const caller = await requireAuth()
    const { uid } = await params

    if (caller.uid !== uid) {
      await requirePermission('users:read')
    }

    const userDoc = await adminDb.collection('users').doc(uid).get()
    if (!userDoc.exists) {
      throw new AppError('USER_NOT_FOUND', 'Usuario no encontrado', 404, false)
    }

    const userData = userDoc.data()
    const roles = (userData?.roles as UserRole[]) ?? ['cliente']
    const preferences = mergeWithDefaults(
      userData?.notificationPreferences as Partial<NotificationPreferences> | undefined,
      roles
    )

    return NextResponse.json({ preferences })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PATCH /api/users/[uid]/preferences — Update notification preferences
 * Owner only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const caller = await requireAuth()
    const { uid } = await params

    if (caller.uid !== uid) {
      throw new AppError('INSUFFICIENT_PERMISSIONS', 'Solo puedes actualizar tus propias preferencias', 403, false)
    }

    const body = await request.json()
    const parsed = notificationPreferencesSchema.safeParse(body)

    if (!parsed.success) {
      throw new AppError(
        'PREFERENCE_VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Preferencias invalidas',
        400,
        false
      )
    }

    // Read current user to get roles and existing prefs
    const userDoc = await adminDb.collection('users').doc(uid).get()
    if (!userDoc.exists) {
      throw new AppError('USER_NOT_FOUND', 'Usuario no encontrado', 404, false)
    }

    const userData = userDoc.data()
    const roles = (userData?.roles as UserRole[]) ?? ['cliente']
    const existingPrefs = userData?.notificationPreferences as Partial<NotificationPreferences> | undefined

    // Filter incoming categories to only allowed for user's roles
    const allowedCategories = new Set(
      roles.flatMap((role) => ROLE_NOTIFICATION_CATEGORIES[role] ?? [])
    )

    const newPrefs: Record<string, unknown> = {}

    if (parsed.data.categories) {
      const filtered: Record<string, boolean> = {}
      for (const [key, value] of Object.entries(parsed.data.categories)) {
        if (allowedCategories.has(key as NotificationCategoryKey)) {
          filtered[key] = value
        }
      }
      newPrefs.categories = { ...(existingPrefs?.categories ?? {}), ...filtered }
    }

    if (parsed.data.quietHours) {
      newPrefs.quietHours = parsed.data.quietHours
    }

    if (parsed.data.channels) {
      newPrefs.channels = parsed.data.channels
    }

    if (parsed.data.timezone) {
      newPrefs.timezone = parsed.data.timezone
    }

    const mergedPrefs = {
      ...(existingPrefs ?? {}),
      ...newPrefs,
    }

    await adminDb.collection('users').doc(uid).update({
      notificationPreferences: mergedPrefs,
      updatedAt: FieldValue.serverTimestamp(),
    })

    const finalPrefs = mergeWithDefaults(mergedPrefs as Partial<NotificationPreferences>, roles)

    return NextResponse.json({ preferences: finalPrefs })
  } catch (error) {
    return handleApiError(error)
  }
}
