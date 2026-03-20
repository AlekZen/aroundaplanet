import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { verifyPaymentSchema } from '@/schemas/paymentSchema'

const PAYMENTS_COLLECTION = 'payments'

interface RouteContext {
  params: Promise<{ paymentId: string }>
}

/**
 * PATCH /api/payments/[paymentId]/verify — Admin verify/reject/request info
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const claims = await requirePermission('payments:verify')
    const { paymentId } = await context.params

    const body = await request.json()
    const parsed = verifyPaymentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos invalidos', retryable: false },
        { status: 400 }
      )
    }

    const { action, rejectionNote } = parsed.data

    const paymentRef = adminDb.collection(PAYMENTS_COLLECTION).doc(paymentId)
    const paymentSnap = await paymentRef.get()

    if (!paymentSnap.exists) {
      throw new AppError('PAYMENT_NOT_FOUND', 'Pago no encontrado', 404)
    }

    const currentStatus = paymentSnap.data()?.status

    // Only pending_verification or info_requested payments can be acted upon
    if (currentStatus !== 'pending_verification' && currentStatus !== 'info_requested') {
      throw new AppError(
        'INVALID_STATE',
        `No se puede ${action} un pago con estado "${currentStatus}"`,
        409,
        false
      )
    }

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    }

    switch (action) {
      case 'verify':
        updateData.status = 'verified'
        updateData.verifiedBy = claims.uid
        updateData.verifiedAt = FieldValue.serverTimestamp()
        updateData.rejectionNote = null
        break
      case 'reject':
        updateData.status = 'rejected'
        updateData.verifiedBy = claims.uid
        updateData.verifiedAt = FieldValue.serverTimestamp()
        updateData.rejectionNote = rejectionNote ?? ''
        break
      case 'request_info':
        updateData.status = 'info_requested'
        updateData.rejectionNote = rejectionNote ?? 'Se requiere informacion adicional'
        break
    }

    await paymentRef.update(updateData)

    return NextResponse.json({
      paymentId,
      status: updateData.status,
      action,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
