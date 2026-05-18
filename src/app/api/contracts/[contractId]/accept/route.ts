import { NextRequest, NextResponse } from 'next/server'
import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
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

    // Resolver nombre del aceptante para auditoría (fuera de tx — lectura de users,
    // no parte del invariante de contract)
    const userDoc = await adminDb.collection('users').doc(claims.uid).get()
    const u = userDoc.data()
    const fullName = `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim()
    const acceptedByName = u?.displayName ?? (fullName || claims.uid)
    const ip = clientIp(request)

    const ref = adminDb.collection('contracts').doc(contractId)

    // runTransaction re-chequea condiciones y escribe atómicamente —
    // evita TOCTOU si admin revoca sharedWithClient entre la lectura y la escritura.
    let alreadyAccepted = false
    let existingAcceptedAt: string | undefined
    let existingAcceptedByUid: string | undefined

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new AppError('CONTRACT_NOT_FOUND', 'Contrato no encontrado', 404)
      const c = snap.data() as DocumentData

      if (c.clientUserId !== claims.uid) {
        throw new AppError('FORBIDDEN', 'Solo el cliente dueño del contrato puede aceptarlo', 403)
      }
      if (c.sharedWithClient !== true) {
        throw new AppError('NOT_SHARED', 'El admin aún no ha compartido este contrato contigo', 403)
      }
      if (c.acceptedAt) {
        // Idempotente: ya aceptado. Capturar para respuesta fuera de tx.
        alreadyAccepted = true
        existingAcceptedAt = c.acceptedAt?.toDate?.()?.toISOString() ?? c.acceptedAt
        existingAcceptedByUid = c.acceptedByUid
        return
      }

      tx.update(ref, {
        acceptedAt: FieldValue.serverTimestamp(),
        acceptedByUid: claims.uid,
        acceptedByName,
        acceptedIp: ip,
        updatedAt: FieldValue.serverTimestamp(),
      })
    })

    if (alreadyAccepted) {
      return NextResponse.json({
        contractId,
        alreadyAccepted: true,
        acceptedAt: existingAcceptedAt,
        acceptedByUid: existingAcceptedByUid,
      })
    }

    return NextResponse.json({ contractId, acceptedByName })
  } catch (error) {
    return handleApiError(error)
  }
}
