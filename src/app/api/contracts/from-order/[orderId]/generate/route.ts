import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'
import {
  createContractSchema,
  contractSnapshotSchema,
  type ContractSnapshot,
} from '@/schemas/contractSchema'
import { tripContractFieldsSchema, type TripContractFields } from '@/schemas/tripSchema'
import { currencyToSpanish, formatMxnFromCents } from '@/lib/pdf/currencyToSpanish'
import { renderAndUploadContract } from '@/lib/pdf/contracts/generate'

export const runtime = 'nodejs'
export const maxDuration = 60

const CONTRACTS = 'contracts'
const ORDERS = 'orders'
const TRIPS = 'trips'
const ODOO_AGENTS = 'odooAgents'
const USERS = 'users'

async function resolveAgentName(agentId: string | null | undefined): Promise<string | null> {
  if (!agentId) return null
  const u = await adminDb.collection(USERS).doc(agentId).get()
  if (u.exists) {
    const d = u.data()!
    const full = `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim()
    const resolved = d.displayName ?? (full || null)
    if (resolved) return resolved
  }
  const o = await adminDb.collection(ODOO_AGENTS).doc(agentId).get()
  return o.exists ? (o.data()?.name ?? null) : null
}

/**
 * Lee los campos contract del trip Firestore y valida que estén completos.
 * Cualquier viaje (actual o nuevo) genera contrato sin tocar código siempre que
 * tenga sus `contract*` campos llenados en Firestore.
 */
async function loadTripContractFields(
  tripId: string | null | undefined
): Promise<
  | { ok: true; tripDoc: Record<string, unknown>; contract: TripContractFields }
  | { ok: false; reason: string }
> {
  if (!tripId) {
    return {
      ok: false,
      reason: 'La orden no tiene tripId. Asigna el viaje a la orden antes de generar el contrato.',
    }
  }
  const t = await adminDb.collection(TRIPS).doc(tripId).get()
  if (!t.exists) {
    return {
      ok: false,
      reason: `El viaje ${tripId} no existe en el catálogo Firestore.`,
    }
  }
  const data = t.data()!
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
    if (typeof data.contractPlazoDias !== 'number') missing.push('Plazo días')
    if (!Array.isArray(data.contractIncluye) || data.contractIncluye.length === 0) missing.push('Incluye (al menos 1 ítem)')
    if (!displayName) missing.push('Nombre del destino')
    const reason = missing.length
      ? `Faltan datos del contrato en el viaje: ${missing.join(', ')}.`
      : (parsed.error.issues[0]?.message ?? 'Datos del contrato inválidos en el viaje.')
    return { ok: false, reason: `${reason} Edítalos en /admin/trips/${tripId}.` }
  }
  return { ok: true, tripDoc: data, contract: parsed.data }
}

/**
 * POST /api/contracts/from-order/[orderId]/generate
 * Admin/superadmin genera (o regenera) un contrato PDF para una orden.
 * Datos del contrato vienen del trip Firestore (no de plantillas separadas).
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const claims = await requireAuth()
    const roles = claims.roles ?? []
    if (!roles.some((r) => r === 'admin' || r === 'superadmin')) {
      throw new AppError('FORBIDDEN', 'Requiere rol admin o superadmin', 403, false)
    }

    const { orderId } = await context.params
    if (!orderId) throw new AppError('VALIDATION_ERROR', 'orderId requerido', 400)

    const body = await req.json().catch(() => ({}))
    // `templateId` ya no es requerido (no existe plantilla por destino) pero se
    // mantiene en el schema por backward-compat. Los snapshotOverrides siguen vigentes.
    const parsed = createContractSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Datos inválidos',
        400
      )
    }
    const { snapshotOverrides } = parsed.data

    const orderSnap = await adminDb.collection(ORDERS).doc(orderId).get()
    if (!orderSnap.exists) throw new AppError('ORDER_NOT_FOUND', 'Orden no encontrada', 404)
    const order = orderSnap.data()!

    const tripLoad = await loadTripContractFields(order.tripId as string | null | undefined)
    if (!tripLoad.ok) {
      throw new AppError('TRIP_CONTRACT_NOT_CONFIGURED', tripLoad.reason, 400)
    }
    const { contract: tripContract } = tripLoad

    const agentName = await resolveAgentName(order.agentId as string | null | undefined)

    const montoTotalCents =
      typeof snapshotOverrides?.montoTotalCents === 'number'
        ? snapshotOverrides.montoTotalCents
        : Number(order.amountTotalCents ?? 0)

    if (!Number.isFinite(montoTotalCents) || montoTotalCents <= 0) {
      throw new AppError(
        'ORDER_MISSING_AMOUNT',
        'La orden no tiene amountTotalCents válido. Establece el monto antes de generar el contrato.',
        400
      )
    }

    const anticipoCents = snapshotOverrides?.anticipoCents ?? null
    const saldoCents =
      anticipoCents !== null && anticipoCents !== undefined && anticipoCents > 0
        ? Math.max(montoTotalCents - anticipoCents, 0)
        : null

    const snapshotBase: ContractSnapshot = contractSnapshotSchema.parse({
      nombreCliente: snapshotOverrides?.nombreCliente ?? order.contactName ?? 'CLIENTE',
      nombreAcompanantes: snapshotOverrides?.nombreAcompanantes ?? null,
      viajeDestino: snapshotOverrides?.viajeDestino ?? tripContract.displayName,
      viajeTemporada: snapshotOverrides?.viajeTemporada ?? tripContract.displayName,
      periodoViaje: snapshotOverrides?.periodoViaje ?? tripContract.displayName,
      fechaSalida: snapshotOverrides?.fechaSalida ?? null,
      fechaRegreso: snapshotOverrides?.fechaRegreso ?? null,
      montoTotalCents,
      montoTotalFormatted: formatMxnFromCents(montoTotalCents),
      montoTotalLetras: currencyToSpanish(montoTotalCents),
      anticipoCents,
      anticipoFormatted: anticipoCents ? formatMxnFromCents(anticipoCents) : null,
      anticipoLetras: anticipoCents ? currencyToSpanish(anticipoCents) : null,
      saldoCents,
      saldoFormatted: saldoCents ? formatMxnFromCents(saldoCents) : null,
      agenteId: order.agentId ?? null,
      agenteName: agentName,
      ciudadFirma: snapshotOverrides?.ciudadFirma ?? 'Ocotlán, Jalisco',
    })

    // Versionado: cuenta contratos previos para esta orden.
    // Patrón mirror del versionado de pagos (Story 9.2): leemos el contador en una
    // transacción para evitar que dos POST simultáneos asignen la misma version.
    // El render+upload del PDF se hace FUERA de la transacción (operación lenta y
    // externa), pero la reserva del docId+version se commitea atómicamente.
    const contractRef = adminDb.collection(CONTRACTS).doc()
    const version = await adminDb.runTransaction(async (tx) => {
      const prev = await tx.get(
        adminDb.collection(CONTRACTS).where('orderId', '==', orderId)
      )
      // Reserva el slot escribiendo un placeholder; el set final con pdfUrl
      // ocurre afuera con merge:true. Esto serializa las concurrencias por orden.
      const nextVersion = prev.size + 1
      tx.set(contractRef, {
        contractId: contractRef.id,
        orderId,
        version: nextVersion,
        _reserved: true,
        createdAt: FieldValue.serverTimestamp(),
      })
      return nextVersion
    })
    const generatedAtIso = new Date().toISOString()

    // ContractDocument espera la shape de "ContractTemplate" (legacy). Adaptamos
    // los datos del trip al shape esperado.
    const templateForRender = {
      templateId: `trip:${order.tripId}`,
      templateKey: (order.tripId as string).replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
      destinoLabel: tripContract.displayName,
      scope: (tripContract.plazoDias >= 30 ? 'internacional' : 'nacional') as 'internacional' | 'nacional',
      plazoLimitePagoDias: tripContract.plazoDias,
      anexoIncluye: tripContract.incluye,
      anexoVisitamos: tripContract.visitamos,
      anexoNoIncluye: tripContract.noIncluye,
      active: true,
      notes: null,
    }

    const { pdfUrl, pdfStoragePath } = await renderAndUploadContract({
      contractId: contractRef.id,
      orderId,
      template: templateForRender,
      snapshot: snapshotBase,
      generatedAtIso,
    })

    const userDoc = await adminDb.collection(USERS).doc(claims.uid).get()
    const userData = userDoc.data()
    const fullUserName = `${userData?.firstName ?? ''} ${userData?.lastName ?? ''}`.trim()
    const generatedByName = userData?.displayName ?? (fullUserName || claims.uid)

    await contractRef.set(
      {
        contractId: contractRef.id,
        orderId,
        tripId: order.tripId ?? null,
        templateId: templateForRender.templateId,
        templateKey: templateForRender.templateKey,
        snapshot: snapshotBase,
        pdfUrl,
        pdfStoragePath,
        generatedBy: claims.uid,
        generatedByName,
        version,
        clientUserId: order.userId ?? null,
        agentId: order.agentId ?? null,
        sharedWithClient: false,
        sharedWithAgent: false,
        acceptedAt: null,
        acceptedByUid: null,
        acceptedByName: null,
        acceptedIp: null,
        _reserved: FieldValue.delete(),
      },
      { merge: true }
    )

    await adminDb.collection(ORDERS).doc(orderId).update({
      contractId: contractRef.id,
      contractPdfUrl: pdfUrl,
      contractVersion: version,
      contractGeneratedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json(
      { contractId: contractRef.id, pdfUrl, version },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
