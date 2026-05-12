import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { dismissBodySchema } from '@/schemas/dedupSchema'

const DISMISSALS_COLLECTION = 'paymentDedupDismissals'

/** POST: marca cluster como "No es duplicado real". Solo Firestore (no toca Odoo). */
export async function POST(request: NextRequest) {
  try {
    const claims = await requirePermission('payments:verify')
    const body = await request.json()
    const parsed = dismissBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos invalidos', retryable: false },
        { status: 400 },
      )
    }
    const { clusterId, memberOdooIds, reason } = parsed.data

    await adminDb.collection(DISMISSALS_COLLECTION).doc(clusterId).set({
      clusterId,
      memberOdooIds,
      reason: reason ?? null,
      dismissedBy: claims.uid,
      dismissedAt: FieldValue.serverTimestamp(),
    }, { merge: false })

    return NextResponse.json({ clusterId, dismissed: true })
  } catch (error) {
    return handleApiError(error)
  }
}

/** DELETE: revierte el dismiss (Paloma toggle "Mostrar dismissed" + click revertir). */
export async function DELETE(request: NextRequest) {
  try {
    await requirePermission('payments:verify')
    const body = await request.json()
    const clusterId = typeof body?.clusterId === 'string' ? body.clusterId : null
    if (!clusterId) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'clusterId requerido', retryable: false },
        { status: 400 },
      )
    }
    await adminDb.collection(DISMISSALS_COLLECTION).doc(clusterId).delete()
    return NextResponse.json({ clusterId, dismissed: false })
  } catch (error) {
    return handleApiError(error)
  }
}
