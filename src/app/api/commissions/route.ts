import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/handleApiError'
import { commissionListQuerySchema } from '@/schemas/commissionSchema'
import { AGENT_OVERRIDE_ROLES } from '@/config/roles'

/**
 * GET /api/commissions — list commissions
 * Agents see only their own approved/paid commissions.
 * Admin/Director/SuperAdmin can see all, filter by agentId/status/period.
 */
export async function GET(request: NextRequest) {
  try {
    const claims = await requireAuth()
    const { searchParams } = request.nextUrl

    const parsed = commissionListQuerySchema.safeParse({
      status: searchParams.get('status') || undefined,
      period: searchParams.get('period') || undefined,
      agentId: searchParams.get('agentId') || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos inválidos', retryable: false },
        { status: 400 }
      )
    }

    const { status, period, agentId: queryAgentId } = parsed.data

    const isAdmin = claims.roles.some((r) => AGENT_OVERRIDE_ROLES.includes(r as never))
    const isAgent = !isAdmin && !!claims.agentId

    // F-05 fix: clients without agentId must not see any commissions
    if (!isAdmin && !claims.agentId) {
      return NextResponse.json({ commissions: [], total: 0 })
    }

    // Determine which agentId to filter by
    let filterAgentId: string | undefined
    if (isAgent) {
      filterAgentId = claims.agentId
    } else if (isAdmin && queryAgentId) {
      filterAgentId = queryAgentId
    }

    // Build collection group query
    let query: FirebaseFirestore.Query = adminDb.collectionGroup('commissions')

    if (filterAgentId) {
      query = query.where('agentId', '==', filterAgentId)
    }

    // Agents can only see approved/paid (never pending)
    if (isAgent) {
      query = query.where('status', 'in', ['approved', 'paid'])
    } else if (status) {
      query = query.where('status', '==', status)
    }

    if (period) {
      query = query.where('period', '==', period)
    }

    query = query.orderBy('createdAt', 'desc').limit(200)

    const snapshot = await query.get()
    const commissions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    return NextResponse.json({ commissions, total: commissions.length })
  } catch (error) {
    return handleApiError(error)
  }
}
