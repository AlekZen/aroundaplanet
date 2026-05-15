import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'
import { tripContractFieldsSchema } from '@/schemas/tripSchema'

export const runtime = 'nodejs'

/**
 * GET /api/trips/[tripId]/contract-config
 * Devuelve el estado de configuración de contrato para un viaje:
 *   - ok=true + fields cuando está listo
 *   - ok=false + reason cuando falta info
 * Usado por OrderContractCard para mostrar el banner correcto.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ tripId: string }> }
) {
  try {
    const claims = await requireAuth()
    const roles = claims.roles ?? []
    if (!roles.some((r) => r === 'admin' || r === 'superadmin' || r === 'director')) {
      throw new AppError('FORBIDDEN', 'Requiere rol admin/superadmin/director', 403)
    }

    const { tripId } = await context.params
    if (!tripId) throw new AppError('VALIDATION_ERROR', 'tripId requerido', 400)

    const snap = await adminDb.collection('trips').doc(tripId).get()
    if (!snap.exists) {
      return NextResponse.json({
        ok: false,
        reason: `El viaje ${tripId} no existe en el catálogo.`,
      })
    }
    const data = snap.data()!
    const displayName = (data.contractDisplayName ?? data.odooName ?? data.name) as string | undefined
    const parsed = tripContractFieldsSchema.safeParse({
      plazoDias: data.contractPlazoDias,
      incluye: data.contractIncluye,
      visitamos: data.contractVisitamos,
      noIncluye: data.contractNoIncluye,
      displayName,
    })
    if (!parsed.success) {
      const missing: string[] = []
      if (typeof data.contractPlazoDias !== 'number') missing.push('plazo de pago en días')
      if (!Array.isArray(data.contractIncluye) || data.contractIncluye.length === 0)
        missing.push('al menos 1 ítem en INCLUYE')
      if (!displayName) missing.push('nombre del destino')
      return NextResponse.json({
        ok: false,
        reason:
          missing.length > 0
            ? `Faltan: ${missing.join(', ')}.`
            : parsed.error.issues[0]?.message ?? 'Datos del contrato inválidos.',
        editUrl: `/admin/trips/${tripId}`,
      })
    }

    return NextResponse.json({
      ok: true,
      fields: parsed.data,
      editUrl: `/admin/trips/${tripId}`,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
