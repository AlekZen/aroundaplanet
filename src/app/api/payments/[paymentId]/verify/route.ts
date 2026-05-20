import { NextRequest, NextResponse } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { verifyPaymentSchema } from '@/schemas/paymentSchema'
import { createCommissionFromPayment } from './createCommission'
import { syncVerifiedPaymentToOdoo } from '@/lib/odoo/payments-push'

const PAYMENTS_COLLECTION = 'payments'
const ORDERS_COLLECTION = 'orders'
const CONTRACTS_COLLECTION = 'contracts'

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

    // Story 10.6 AC2: re-leer la orden al momento del verify para denormalizar
    // agentId actualizado en el pago (puede haber sido asignado por admin después
    // de crearse el pago). También permite el auto-share del contrato.
    let resolvedOrderAgentId: string | null = null
    let resolvedOrderContractId: string | null = null
    let resolvedOrderClientUid: string | null = null
    if (action === 'verify') {
      const paymentData = paymentSnap.data() ?? {}
      const orderId = typeof paymentData.orderId === 'string' ? paymentData.orderId : null
      if (orderId) {
        const orderSnap = await adminDb.collection(ORDERS_COLLECTION).doc(orderId).get()
        const orderData = orderSnap.data()
        if (orderData) {
          resolvedOrderAgentId = typeof orderData.agentId === 'string' && orderData.agentId.length > 0
            ? orderData.agentId
            : null
          resolvedOrderContractId = typeof orderData.contractId === 'string' && orderData.contractId.length > 0
            ? orderData.contractId
            : null
          resolvedOrderClientUid = typeof orderData.userId === 'string' && orderData.userId.length > 0
            ? orderData.userId
            : null
        }
      }
    }

    switch (action) {
      case 'verify':
        updateData.status = 'verified'
        updateData.verifiedBy = claims.uid
        updateData.verifiedAt = FieldValue.serverTimestamp()
        updateData.rejectionNote = null
        // Denormaliza agentId desde la orden si el pago no lo tenía (admin lo
        // pudo haber asignado después de crear el pago).
        if (resolvedOrderAgentId) {
          const currentAgentId = paymentSnap.data()?.agentId
          if (typeof currentAgentId !== 'string' || currentAgentId.length === 0) {
            updateData.agentId = resolvedOrderAgentId
          }
        }
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

    // Fire-and-forget: create commission if payment verified with agentId
    let odooSync: Awaited<ReturnType<typeof syncVerifiedPaymentToOdoo>> | null = null
    if (action === 'verify') {
      const paymentData = paymentSnap.data()!
      try {
        await createCommissionFromPayment(paymentId, paymentData)
      } catch (err) {
        console.error('[Commission Hook] Error creating commission:', err)
      }
      // Push idempotente a Odoo (Story 9.2). NUNCA throw: el verify Firestore ya persistió.
      try {
        odooSync = await syncVerifiedPaymentToOdoo(paymentId, paymentData)
      } catch (err) {
        console.error('[Odoo Sync Hook] Error pushing to Odoo:', err)
      }

      // Story 10.6 AC2: auto-share del contrato asociado a la orden.
      // Solo activa, nunca desactiva. Si el contrato no tiene agentId
      // resuelto, queda como está (admin debe asignarlo desde el banner).
      if (resolvedOrderContractId) {
        try {
          const contractRef = adminDb.collection(CONTRACTS_COLLECTION).doc(resolvedOrderContractId)
          const contractSnap = await contractRef.get()
          const contractData = contractSnap.data()
          if (contractData) {
            const contractUpdate: Record<string, unknown> = {}
            const hasAgentId = typeof contractData.agentId === 'string' && contractData.agentId.length > 0
            if (hasAgentId && contractData.sharedWithAgent !== true) {
              contractUpdate.sharedWithAgent = true
            }
            const hasClientUid = typeof contractData.clientUserId === 'string' && contractData.clientUserId.length > 0
            if (hasClientUid && contractData.sharedWithClient !== true) {
              contractUpdate.sharedWithClient = true
            }
            if (Object.keys(contractUpdate).length > 0) {
              contractUpdate.updatedAt = FieldValue.serverTimestamp()
              await contractRef.update(contractUpdate)
              await adminDb.collection('auditLog').add({
                action: 'contract.autoSharedOnVerify',
                targetUid: resolvedOrderClientUid ?? 'unknown',
                performedBy: claims.uid,
                timestamp: FieldValue.serverTimestamp(),
                details: {
                  contractId: resolvedOrderContractId,
                  paymentId,
                  ...contractUpdate,
                },
              })
            }
          }
        } catch (err) {
          console.error('[Auto-share Hook] Error sharing contract:', err)
        }
      }
    }

    return NextResponse.json({
      paymentId,
      status: updateData.status,
      action,
      ...(odooSync ? { odooSync } : {}),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
