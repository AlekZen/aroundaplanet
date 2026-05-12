import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { reconciliationRejectBodySchema } from '@/schemas/reconciliationSchema'

const RECON_LOG_COLLECTION = 'paymentReconciliationLog'

interface RouteContext {
  params: Promise<{ firestorePaymentId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const claims = await requirePermission('payments:verify')
    const { firestorePaymentId } = await context.params

    const body = await request.json()
    const parsed = reconciliationRejectBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos invalidos', retryable: false },
        { status: 400 },
      )
    }
    const { odooPaymentId, reason } = parsed.data

    const logRef = adminDb.collection(RECON_LOG_COLLECTION).doc()
    await logRef.create({
      firestorePaymentId,
      odooPaymentId,
      action: 'rejected',
      reason,
      adminUid: claims.uid,
      createdAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({
      firestorePaymentId,
      odooPaymentId,
      logId: logRef.id,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
