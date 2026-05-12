import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { flagBodySchema } from '@/schemas/dedupSchema'

const FLAGS_COLLECTION = 'paymentDedupFlags'

/** POST: marca cluster "Para revisar". Solo Firestore. */
export async function POST(request: NextRequest) {
  try {
    const claims = await requirePermission('payments:verify')
    const body = await request.json()
    const parsed = flagBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos invalidos', retryable: false },
        { status: 400 },
      )
    }
    const { clusterId, memberOdooIds, note } = parsed.data

    await adminDb.collection(FLAGS_COLLECTION).doc(clusterId).set({
      clusterId,
      memberOdooIds,
      note: note ?? null,
      flaggedBy: claims.uid,
      flaggedAt: FieldValue.serverTimestamp(),
    }, { merge: false })

    return NextResponse.json({ clusterId, flagged: true })
  } catch (error) {
    return handleApiError(error)
  }
}

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
    await adminDb.collection(FLAGS_COLLECTION).doc(clusterId).delete()
    return NextResponse.json({ clusterId, flagged: false })
  } catch (error) {
    return handleApiError(error)
  }
}
