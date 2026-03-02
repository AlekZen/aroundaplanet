import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { syncTrips } from '@/lib/odoo/sync/trip-sync'
import { tripSyncOptionsSchema } from '@/schemas/tripSchema'

const SYNC_LOCK_DOC = 'syncLocks/trip-sync'
const SYNC_LOCK_TTL_MS = 5 * 60 * 1000 // 5 min max — auto-expire stale locks

export async function POST(request: NextRequest) {
  try {
    const claims = await requirePermission('sync:odoo')

    const body = await request.json().catch(() => ({}))
    const parsed = tripSyncOptionsSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Input invalido', retryable: false },
        { status: 400 },
      )
    }

    // Distributed lock: prevent concurrent syncs across Cloud Run instances
    const lockRef = adminDb.doc(SYNC_LOCK_DOC)
    const lockAcquired = await adminDb.runTransaction(async (tx) => {
      const lockSnap = await tx.get(lockRef)
      const lockData = lockSnap.data()

      if (lockData?.isLocked) {
        const lockedAt = lockData.lockedAt as Timestamp
        const age = Date.now() - lockedAt.toMillis()
        // Only respect lock if it's fresh (< TTL). Stale locks = crashed process
        if (age < SYNC_LOCK_TTL_MS) {
          return false
        }
      }

      tx.set(lockRef, {
        isLocked: true,
        lockedAt: Timestamp.now(),
        lockedBy: claims.uid,
      })
      return true
    })

    if (!lockAcquired) {
      throw new AppError(
        'SYNC_IN_PROGRESS',
        'Ya hay una sincronizacion en progreso. Espera unos minutos e intenta de nuevo.',
        429,
        true,
      )
    }

    try {
      const result = await syncTrips(parsed.data, claims.uid)
      return NextResponse.json(result)
    } finally {
      // Always release lock, even on error
      await lockRef.set({ isLocked: false, releasedAt: Timestamp.now() }).catch(() => {})
    }
  } catch (error) {
    return handleApiError(error)
  }
}
