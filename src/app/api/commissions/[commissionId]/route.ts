import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { updateCommissionStatusSchema } from '@/schemas/commissionSchema'

interface RouteContext {
  params: Promise<{ commissionId: string }>
}

/** Valid status transitions */
const VALID_TRANSITIONS: Record<string, string> = {
  'pending→approved': 'approved',
  'approved→paid': 'paid',
}

/**
 * PATCH /api/commissions/[commissionId]?agentId=X — admin changes commission status
 * agentId from query param enables O(1) lookup (F-02 fix).
 * Falls back to collection group scan if agentId not provided.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const claims = await requirePermission('commissions:manage')
    const { commissionId } = await context.params
    const agentIdParam = request.nextUrl.searchParams.get('agentId')

    const body = await request.json()
    const parsed = updateCommissionStatusSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos inválidos', retryable: false },
        { status: 400 }
      )
    }

    const { status: newStatus, commissionAmountCents } = parsed.data

    // O(1) direct lookup when agentId provided (F-02 fix)
    let doc: FirebaseFirestore.DocumentSnapshot | undefined
    if (agentIdParam) {
      const directDoc = await adminDb
        .doc(`agents/${agentIdParam}/commissions/${commissionId}`)
        .get()
      if (directDoc.exists) {
        doc = directDoc
      }
    }

    // Fallback: collection group scan (safe for small datasets)
    if (!doc) {
      const snapshot = await adminDb
        .collectionGroup('commissions')
        .orderBy('createdAt', 'desc')
        .limit(500)
        .get()
      doc = snapshot.docs.find((d) => d.id === commissionId)
    }

    if (!doc?.exists) {
      throw new AppError('COMMISSION_NOT_FOUND', 'Comisión no encontrada', 404)
    }

    const currentData = doc.data()!
    const currentStatus = currentData.status as string
    const agentId = currentData.agentId as string | undefined

    // Validate transition
    const transitionKey = `${currentStatus}→${newStatus}`
    if (!VALID_TRANSITIONS[transitionKey]) {
      throw new AppError(
        'INVALID_TRANSITION',
        `Transición inválida: ${currentStatus} → ${newStatus}`,
        409,
        false
      )
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (newStatus === 'approved') {
      updateData.approvedBy = claims.uid
      updateData.approvedAt = FieldValue.serverTimestamp()
    }

    if (newStatus === 'paid') {
      updateData.paidAt = FieldValue.serverTimestamp()
    }

    // Amount adjustment only on pending commissions
    if (commissionAmountCents !== undefined && currentStatus === 'pending') {
      updateData.commissionAmountCents = commissionAmountCents
    }

    await doc.ref.update(updateData)

    return NextResponse.json({
      commissionId: doc.id,
      agentId,
      status: newStatus,
      commissionAmountCents: commissionAmountCents !== undefined && currentStatus === 'pending'
        ? commissionAmountCents
        : currentData.commissionAmountCents,
      approvedBy: newStatus === 'approved' ? claims.uid : currentData.approvedBy,
      approvedAt: newStatus === 'approved' ? null : currentData.approvedAt,
      paidAt: newStatus === 'paid' ? null : currentData.paidAt,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
