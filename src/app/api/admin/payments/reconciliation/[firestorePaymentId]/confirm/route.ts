import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { reconciliationConfirmBodySchema } from '@/schemas/reconciliationSchema'

const PAYMENTS_COLLECTION = 'payments'
const RECON_LOG_COLLECTION = 'paymentReconciliationLog'

interface RouteContext {
  params: Promise<{ firestorePaymentId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const claims = await requirePermission('payments:verify')
    const { firestorePaymentId } = await context.params

    const body = await request.json()
    const parsed = reconciliationConfirmBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos invalidos', retryable: false },
        { status: 400 },
      )
    }
    const { odooPaymentId, confidence, notes } = parsed.data

    const paymentRef = adminDb.collection(PAYMENTS_COLLECTION).doc(firestorePaymentId)

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(paymentRef)
      if (!snap.exists) {
        throw new AppError('PAYMENT_NOT_FOUND', 'Pago Firestore no encontrado', 404, false)
      }
      const data = snap.data()!
      if (data.odooPaymentId != null) {
        throw new AppError('already_linked', 'El pago ya tiene odooPaymentId asignado', 409, false)
      }

      // Uniqueness check
      const takenQuery = await tx.get(
        adminDb.collection(PAYMENTS_COLLECTION).where('odooPaymentId', '==', odooPaymentId).limit(1),
      )
      if (!takenQuery.empty) {
        throw new AppError('odoo_id_taken', 'odooPaymentId ya enlazado a otro pago Firestore', 409, false)
      }

      tx.update(paymentRef, {
        odooPaymentId,
        linkedAt: FieldValue.serverTimestamp(),
        linkedBy: claims.uid,
        linkMatchConfidence: confidence,
        odooSyncStatus: 'legacy_linked',
        updatedAt: FieldValue.serverTimestamp(),
      })

      const logRef = adminDb.collection(RECON_LOG_COLLECTION).doc()
      tx.create(logRef, {
        firestorePaymentId,
        odooPaymentId,
        confidence,
        action: 'linked',
        adminUid: claims.uid,
        notes: notes ?? null,
        createdAt: FieldValue.serverTimestamp(),
      })

      return { logId: logRef.id }
    })

    return NextResponse.json({
      firestorePaymentId,
      odooPaymentId,
      linkedAt: new Date().toISOString(),
      logId: result.logId,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
