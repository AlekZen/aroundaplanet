import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/handleApiError'

export const runtime = 'nodejs'

/**
 * GET /api/contracts/list-mine
 * Lista contratos compartidos al usuario (cliente o agente).
 * Hace dos queries (por clientUserId y por agentId) y une los resultados.
 */
export async function GET() {
  try {
    const claims = await requireAuth()
    const uid = claims.uid
    const agentId = claims.agentId

    const [clientSnap, agentSnap] = await Promise.all([
      adminDb
        .collection('contracts')
        .where('clientUserId', '==', uid)
        .where('sharedWithClient', '==', true)
        .get(),
      agentId
        ? adminDb
            .collection('contracts')
            .where('agentId', '==', agentId)
            .where('sharedWithAgent', '==', true)
            .get()
        : Promise.resolve({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }),
    ])

    const seen = new Set<string>()
    const merge: FirebaseFirestore.DocumentData[] = []
    for (const doc of [...clientSnap.docs, ...agentSnap.docs]) {
      if (seen.has(doc.id)) continue
      seen.add(doc.id)
      const d = doc.data()
      merge.push({
        contractId: doc.id,
        orderId: d.orderId,
        templateKey: d.templateKey,
        clientName: d.snapshot?.nombreCliente ?? null,
        destinoLabel: d.snapshot?.viajeDestino ?? null,
        viajeTemporada: d.snapshot?.viajeTemporada ?? null,
        montoTotalFormatted: d.snapshot?.montoTotalFormatted ?? null,
        agenteName: d.snapshot?.agenteName ?? null,
        version: d.version ?? 1,
        sharedWithClient: d.sharedWithClient === true,
        sharedWithAgent: d.sharedWithAgent === true,
        acceptedAt: d.acceptedAt?.toDate?.()?.toISOString() ?? null,
        viewerRole:
          d.clientUserId === uid
            ? 'client'
            : agentId && d.agentId === agentId
              ? 'agent'
              : 'other',
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
      })
    }

    // Más reciente primero
    merge.sort((a, b) => {
      const aT = (a.createdAt as string | null) ?? ''
      const bT = (b.createdAt as string | null) ?? ''
      return bT.localeCompare(aT)
    })

    return NextResponse.json({ contracts: merge })
  } catch (error) {
    return handleApiError(error)
  }
}
