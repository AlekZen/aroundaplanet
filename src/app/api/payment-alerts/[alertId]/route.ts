import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'

const dismissAlertBodySchema = z.object({
  status: z.literal('dismissed'),
  resolutionNote: z.string().min(5, 'La nota debe tener al menos 5 caracteres').max(500),
})

interface RouteContext {
  params: Promise<{ alertId: string }>
}

/**
 * PATCH /api/payment-alerts/[alertId]
 * Desestima una alerta operativa (status: open → dismissed).
 * Requiere permiso payments:verify (admin/superadmin).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const claims = await requirePermission('payments:verify')
    const { alertId } = await context.params

    const body = await request.json()
    const parsed = dismissAlertBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos inválidos', retryable: false },
        { status: 400 },
      )
    }

    const { resolutionNote } = parsed.data

    const alertRef = adminDb.collection('paymentAlerts').doc(alertId)
    const alertSnap = await alertRef.get()

    if (!alertSnap.exists) {
      throw new AppError('ALERT_NOT_FOUND', 'Alerta no encontrada', 404)
    }

    const alertData = alertSnap.data()!
    if (alertData.status !== 'open') {
      return NextResponse.json(
        { code: 'already_resolved', currentStatus: alertData.status },
        { status: 409 },
      )
    }

    await alertRef.update({
      status: 'dismissed',
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: claims.uid,
      resolutionNote,
    })

    return NextResponse.json({ dismissed: true })
  } catch (error) {
    return handleApiError(error)
  }
}
