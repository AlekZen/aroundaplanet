import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { authorizeAgent } from '@/lib/auth/authorizeAgent'
import { handleApiError } from '@/lib/errors/handleApiError'
import type { AgentMetrics } from '@/types/commission'

interface RouteContext {
  params: Promise<{ agentId: string }>
}

/**
 * GET /api/agents/[agentId]/metrics — agent business metrics
 * Returns verified sales, active clients, pending/earned commissions for current month.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const claims = await requireAuth()
    const { agentId } = await context.params

    authorizeAgent(claims.agentId, claims.roles, agentId)

    // Start of current month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startTimestamp = Timestamp.fromDate(startOfMonth)

    const [
      verifiedPaymentsSnap,
      activeOrdersSnap,
      pendingCommissionsSnap,
      earnedCommissionsSnap,
    ] = await Promise.all([
      // F7: Verified payments this month (real cash in)
      adminDb.collection('payments')
        .where('agentId', '==', agentId)
        .where('status', '==', 'verified')
        .where('createdAt', '>=', startTimestamp)
        .get(),

      // F4: Active orders (limit 500 to avoid degradation)
      adminDb.collection('orders')
        .where('agentId', '==', agentId)
        .where('status', 'in', ['Interesado', 'Confirmado', 'En Progreso'])
        .limit(500)
        .get(),

      // Pending commissions (all time for this agent)
      adminDb.collectionGroup('commissions')
        .where('agentId', '==', agentId)
        .where('status', '==', 'pending')
        .get(),

      // Earned commissions (approved + paid, all time)
      adminDb.collectionGroup('commissions')
        .where('agentId', '==', agentId)
        .where('status', 'in', ['approved', 'paid'])
        .get(),
    ])

    // Sum verified sales
    const verifiedSalesCents = verifiedPaymentsSnap.docs.reduce(
      (sum, doc) => sum + ((doc.data().amountCents as number) || 0),
      0
    )

    // Deduplicate active clients by userId or contactName
    const clientSet = new Set<string>()
    for (const doc of activeOrdersSnap.docs) {
      const data = doc.data()
      const key = (data.userId as string) || (data.contactName as string) || doc.id
      clientSet.add(key)
    }

    const pendingCommissionsCents = pendingCommissionsSnap.docs.reduce(
      (sum, doc) => sum + ((doc.data().commissionAmountCents as number) || 0),
      0
    )

    const earnedCommissionsCents = earnedCommissionsSnap.docs.reduce(
      (sum, doc) => sum + ((doc.data().commissionAmountCents as number) || 0),
      0
    )

    const metrics: AgentMetrics = {
      verifiedSalesCents,
      activeClients: clientSet.size,
      pendingCommissionsCents,
      earnedCommissionsCents,
    }

    return NextResponse.json(metrics)
  } catch (error) {
    return handleApiError(error)
  }
}
