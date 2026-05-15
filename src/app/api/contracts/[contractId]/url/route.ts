import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'
import { refreshSignedUrl } from '@/lib/pdf/storage'

export const runtime = 'nodejs'

/**
 * GET /api/contracts/[contractId]/url
 * Devuelve un signed URL fresco (7d) del PDF si el usuario tiene permiso:
 *   - admin/superadmin/director: siempre
 *   - cliente dueño: si `sharedWithClient=true`
 *   - agente asignado: si `sharedWithAgent=true`
 * Cada llamada regenera el URL — no se persiste para no caducar en Firestore.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ contractId: string }> }
) {
  try {
    const claims = await requireAuth()
    const { contractId } = await context.params
    if (!contractId) throw new AppError('VALIDATION_ERROR', 'contractId requerido', 400)

    const snap = await adminDb.collection('contracts').doc(contractId).get()
    if (!snap.exists) throw new AppError('CONTRACT_NOT_FOUND', 'Contrato no encontrado', 404)
    const c = snap.data()!

    const roles = claims.roles ?? []
    const isAdmin = roles.some((r) => r === 'admin' || r === 'superadmin' || r === 'director')
    const isOwnerClient = c.clientUserId && c.clientUserId === claims.uid && c.sharedWithClient === true
    const isOwnerAgent =
      c.agentId &&
      (c.agentId === claims.uid || c.agentId === claims.agentId) &&
      c.sharedWithAgent === true

    if (!isAdmin && !isOwnerClient && !isOwnerAgent) {
      throw new AppError('FORBIDDEN', 'No tienes acceso a este contrato', 403)
    }

    if (!c.pdfStoragePath) {
      throw new AppError('CONTRACT_NO_PDF', 'El contrato no tiene PDF generado', 422)
    }

    const url = await refreshSignedUrl(c.pdfStoragePath)
    return NextResponse.json({ url, contractId })
  } catch (error) {
    return handleApiError(error)
  }
}
