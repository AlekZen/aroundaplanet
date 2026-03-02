import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { handleApiError } from '@/lib/errors/handleApiError'

/**
 * GET /api/agents/[agentId]/validate
 * Public endpoint — checks if agentId is a valid, active agent.
 * Returns { valid: true } or { valid: false }. No sensitive data exposed.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params

    if (!agentId || agentId.length > 128) {
      return NextResponse.json({ valid: false })
    }

    const snap = await adminDb.collection('users').doc(agentId).get()

    if (!snap.exists) {
      return NextResponse.json({ valid: false })
    }

    const data = snap.data()
    const isActiveAgent =
      data?.isActive === true &&
      Array.isArray(data?.roles) &&
      data.roles.includes('agente')

    return NextResponse.json({ valid: isActiveAgent })
  } catch (error) {
    return handleApiError(error)
  }
}
