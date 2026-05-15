import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'

export const runtime = 'nodejs'

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * POST /api/contracts/[contractId]/accept
 * El cliente acepta el contrato. NO es firma electrónica SAT — es evidencia
 * de aceptación (timestamp + uid + IP). Persistida para futura disputa.
 * Idempotente: si ya está aceptado, devuelve el `acceptedAt` existente.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ contractId: string }> }
) {
  try {
    const claims = await requireAuth()
    const { contractId } = await context.params
    if (!contractId) throw new AppError('VALIDATION_ERROR', 'contractId requerido', 400)

    const ref = adminDb.collection('contracts').doc(contractId)
    const snap = await ref.get()
    if (!snap.exists) throw new AppError('CONTRACT_NOT_FOUND', 'Contrato no encontrado', 404)
    const c = snap.data()!

    if (c.clientUserId !== claims.uid) {
      throw new AppError('FORBIDDEN', 'Solo el cliente dueño del contrato puede aceptarlo', 403)
    }
    if (c.sharedWithClient !== true) {
      throw new AppError('NOT_SHARED', 'El admin aún no ha compartido este contrato contigo', 403)
    }
    if (c.acceptedAt) {
      // Idempotente: ya aceptado previamente.
      return NextResponse.json({
        contractId,
        alreadyAccepted: true,
        acceptedAt: c.acceptedAt?.toDate?.()?.toISOString() ?? c.acceptedAt,
        acceptedByUid: c.acceptedByUid,
      })
    }

    // Resolver nombre del aceptante para auditoría
    const userDoc = await adminDb.collection('users').doc(claims.uid).get()
    const u = userDoc.data()
    const fullName = `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim()
    const acceptedByName = u?.displayName ?? (fullName || claims.uid)

    await ref.update({
      acceptedAt: FieldValue.serverTimestamp(),
      acceptedByUid: claims.uid,
      acceptedByName,
      acceptedIp: clientIp(request),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ contractId, acceptedByName })
  } catch (error) {
    return handleApiError(error)
  }
}
