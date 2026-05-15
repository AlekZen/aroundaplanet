import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'
import { shareContractSchema } from '@/schemas/contractSchema'

export const runtime = 'nodejs'

/**
 * POST /api/contracts/[contractId]/share
 * Admin/superadmin alterna `sharedWithClient` / `sharedWithAgent` para autorizar
 * que el cliente o el agente vean el PDF en sus portales respectivos.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ contractId: string }> }
) {
  try {
    const claims = await requireAuth()
    const roles = claims.roles ?? []
    if (!roles.some((r) => r === 'admin' || r === 'superadmin')) {
      throw new AppError('FORBIDDEN', 'Requiere rol admin o superadmin', 403)
    }

    const { contractId } = await context.params
    if (!contractId) throw new AppError('VALIDATION_ERROR', 'contractId requerido', 400)

    const body = await request.json().catch(() => ({}))
    const parsed = shareContractSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Datos inválidos',
        400
      )
    }

    const ref = adminDb.collection('contracts').doc(contractId)
    const snap = await ref.get()
    if (!snap.exists) throw new AppError('CONTRACT_NOT_FOUND', 'Contrato no encontrado', 404)

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
    if (parsed.data.sharedWithClient !== undefined) update.sharedWithClient = parsed.data.sharedWithClient
    if (parsed.data.sharedWithAgent !== undefined) update.sharedWithAgent = parsed.data.sharedWithAgent

    await ref.update(update)

    const fresh = await ref.get()
    const d = fresh.data()!
    return NextResponse.json({
      contractId,
      sharedWithClient: d.sharedWithClient ?? false,
      sharedWithAgent: d.sharedWithAgent ?? false,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
