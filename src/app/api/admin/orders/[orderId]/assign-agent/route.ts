import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'

export const runtime = 'nodejs'

const inputSchema = z.object({
  agentId: z.string().trim().min(1).max(128).nullable(),
})

interface RouteContext {
  params: Promise<{ orderId: string }>
}

/**
 * Story 10.6 AC5 — POST /api/admin/orders/[orderId]/assign-agent
 *
 * Admin/superadmin asigna (o desasigna con agentId: null) un agente a una orden.
 * Propaga al contrato asociado (`order.contractId`) si existe. Si la orden tiene
 * pagos verificados sin agentId, los actualiza también — la denormalización en
 * verify (AC2) ya ocurre al verificar, pero pagos verificados antes del
 * fix necesitan este backfill ligero.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const claims = await requireAuth()
    const roles = claims.roles ?? []
    if (!roles.some((r) => r === 'admin' || r === 'superadmin')) {
      throw new AppError('FORBIDDEN', 'Requiere rol admin o superadmin', 403, false)
    }

    const { orderId } = await context.params
    if (!orderId) throw new AppError('VALIDATION_ERROR', 'orderId requerido', 400)

    const body = await request.json().catch(() => ({}))
    const parsed = inputSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
    }
    const newAgentId = parsed.data.agentId

    // Resolver agentName si hay agentId
    let agentName: string | null = null
    if (newAgentId) {
      const userSnap = await adminDb.collection('users').doc(newAgentId).get()
      if (userSnap.exists) {
        const u = userSnap.data()!
        const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
        agentName = (u.displayName as string | undefined) ?? (full || null)
      }
      if (!agentName) {
        throw new AppError(
          'AGENT_NOT_FOUND',
          'El usuario seleccionado no existe o no tiene nombre',
          404
        )
      }
    }

    const orderRef = adminDb.collection('orders').doc(orderId)
    const orderSnap = await orderRef.get()
    if (!orderSnap.exists) {
      throw new AppError('ORDER_NOT_FOUND', 'Orden no encontrada', 404)
    }
    const orderData = orderSnap.data()!

    await orderRef.update({
      agentId: newAgentId,
      agentName,
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Propagar al contrato (si la orden tiene uno) y auto-share si ya hay pagos verified
    let contractUpdated = false
    if (orderData.contractId && typeof orderData.contractId === 'string') {
      const contractRef = adminDb.collection('contracts').doc(orderData.contractId)
      const contractSnap = await contractRef.get()
      if (contractSnap.exists) {
        const contractUpdate: Record<string, unknown> = {
          agentId: newAgentId,
          updatedAt: FieldValue.serverTimestamp(),
        }
        // Si hay pagos verified de esta orden y agentId nuevo no es null,
        // activar sharedWithAgent (no desactivar si ya estaba true).
        if (newAgentId) {
          const verifiedSnap = await adminDb
            .collection('payments')
            .where('orderId', '==', orderId)
            .where('status', '==', 'verified')
            .limit(1)
            .get()
          if (!verifiedSnap.empty) {
            contractUpdate.sharedWithAgent = true
          }
        }
        await contractRef.update(contractUpdate)
        contractUpdated = true
      }
    }

    // Backfill agentId en pagos verificados sin agentId
    let paymentsUpdated = 0
    if (newAgentId) {
      const paymentsSnap = await adminDb
        .collection('payments')
        .where('orderId', '==', orderId)
        .where('status', '==', 'verified')
        .get()
      for (const docSnap of paymentsSnap.docs) {
        const d = docSnap.data()
        const currentAgentId = d.agentId
        if (typeof currentAgentId !== 'string' || currentAgentId.length === 0) {
          await docSnap.ref.update({
            agentId: newAgentId,
            agentName,
            updatedAt: FieldValue.serverTimestamp(),
          })
          paymentsUpdated++
        }
      }
    }

    await adminDb.collection('auditLog').add({
      action: 'order.assignAgent',
      targetUid: newAgentId ?? 'unassigned',
      performedBy: claims.uid,
      timestamp: FieldValue.serverTimestamp(),
      details: {
        orderId,
        previousAgentId: orderData.agentId ?? null,
        newAgentId,
        contractUpdated,
        paymentsUpdated,
      },
    })

    return NextResponse.json({
      orderId,
      agentId: newAgentId,
      agentName,
      contractUpdated,
      paymentsUpdated,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
