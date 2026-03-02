import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { assignOrderSchema } from '@/schemas/orderSchema'

const ORDERS_COLLECTION = 'orders'
const USERS_COLLECTION = 'users'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    await requirePermission('orders:readAll')
    const { orderId } = await params

    const body = await request.json()
    const parsed = assignOrderSchema.safeParse(body)

    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos invalidos', 400, false)
    }

    const { agentId } = parsed.data

    // Verify agent exists and is active with agente role
    const agentSnap = await adminDb.collection(USERS_COLLECTION).doc(agentId).get()
    if (!agentSnap.exists) {
      throw new AppError('AGENT_NOT_FOUND', 'Agente no encontrado', 404, false)
    }
    const agentData = agentSnap.data()
    if (agentData?.isActive !== true || !Array.isArray(agentData?.roles) || !agentData.roles.includes('agente')) {
      throw new AppError('AGENT_INVALID', 'El usuario no es un agente activo', 400, false)
    }

    // Verify order exists
    const orderRef = adminDb.collection(ORDERS_COLLECTION).doc(orderId)
    const orderSnap = await orderRef.get()
    if (!orderSnap.exists) {
      throw new AppError('ORDER_NOT_FOUND', 'Orden no encontrada', 404, false)
    }

    // Update order with agent assignment
    await orderRef.update({
      agentId,
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Also set assignedAgentId on the user doc if order has a userId
    const orderData = orderSnap.data()
    if (orderData?.userId) {
      const userRef = adminDb.collection(USERS_COLLECTION).doc(orderData.userId)
      const userSnap = await userRef.get()
      if (userSnap.exists) {
        await userRef.update({
          assignedAgentId: agentId,
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
    }

    return NextResponse.json({ orderId, agentId, assigned: true })
  } catch (error) {
    return handleApiError(error)
  }
}
