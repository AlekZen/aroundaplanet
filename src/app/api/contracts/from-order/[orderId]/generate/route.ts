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
import { contractTemplateSchema } from '@/schemas/contractTemplateSchema'
import { currencyToSpanish, formatMxnFromCents } from '@/lib/pdf/currencyToSpanish'
import { renderAndUploadContract } from '@/lib/pdf/contracts/generate'
import { findTemplateForTrip } from '@/lib/pdf/contracts/findTemplate'

export const runtime = 'nodejs'
export const maxDuration = 60

const CONTRACTS = 'contracts'
const CONTRACT_TEMPLATES = 'contractTemplates'
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

async function resolveTripName(tripId: string | null | undefined): Promise<string | null> {
  if (!tripId) return null
  const t = await adminDb.collection(TRIPS).doc(tripId).get()
  return t.data()?.odooName ?? t.data()?.name ?? null
}

/**
 * POST /api/contracts/from-order/[orderId]/generate
 * Admin/superadmin genera (o regenera) un contrato PDF para una orden.
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
    const parsed = createContractSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Datos inválidos',
        400
      )
    }
    const { templateId, snapshotOverrides } = parsed.data

    // Resolver order + template en paralelo
    const [orderSnap, templateSnap] = await Promise.all([
      adminDb.collection(ORDERS).doc(orderId).get(),
      adminDb.collection(CONTRACT_TEMPLATES).doc(templateId).get(),
    ])

    if (!orderSnap.exists) throw new AppError('ORDER_NOT_FOUND', 'Orden no encontrada', 404)
    if (!templateSnap.exists) throw new AppError('TEMPLATE_NOT_FOUND', 'Plantilla no encontrada', 404)

    const order = orderSnap.data()!
    const templateParsed = contractTemplateSchema.safeParse({
      ...templateSnap.data(),
      templateId: templateSnap.id,
    })
    if (!templateParsed.success) {
      throw new AppError('TEMPLATE_INVALID', 'Plantilla corrupta en Firestore', 500)
    }
    const template = templateParsed.data

    // Datos base derivados de la orden
    const [tripName, agentName] = await Promise.all([
      resolveTripName(order.tripId as string | null | undefined),
      resolveAgentName(order.agentId as string | null | undefined),
    ])

    // Defensa: confirmar que la plantilla seleccionada coincide con el viaje.
    // Evita que un admin (o un bug de UI) genere contrato con plantilla equivocada.
    const matchCheck = findTemplateForTrip(
      tripName,
      order.tripId as string | null | undefined,
      [template]
    )
    if (!matchCheck.template) {
      throw new AppError(
        'TEMPLATE_TRIP_MISMATCH',
        `La plantilla "${template.destinoLabel}" no corresponde al viaje "${tripName ?? order.tripId ?? 'sin nombre'}". Elige la plantilla correcta o crea una para este destino.`,
        400
      )
    }

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
      viajeDestino: snapshotOverrides?.viajeDestino ?? template.destinoLabel,
      viajeTemporada: snapshotOverrides?.viajeTemporada ?? tripName ?? template.destinoLabel,
      periodoViaje: snapshotOverrides?.periodoViaje ?? tripName ?? null,
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

    // Versionado: cuenta contratos previos para esta orden
    const prev = await adminDb
      .collection(CONTRACTS)
      .where('orderId', '==', orderId)
      .count()
      .get()
    const version = (prev.data().count ?? 0) + 1

    const contractRef = adminDb.collection(CONTRACTS).doc()
    const generatedAtIso = new Date().toISOString()

    const { pdfUrl, pdfStoragePath } = await renderAndUploadContract({
      contractId: contractRef.id,
      orderId,
      template,
      snapshot: snapshotBase,
      generatedAtIso,
    })

    const userDoc = await adminDb.collection(USERS).doc(claims.uid).get()
    const userData = userDoc.data()
    const fullUserName = `${userData?.firstName ?? ''} ${userData?.lastName ?? ''}`.trim()
    const generatedByName = userData?.displayName ?? (fullUserName || claims.uid)

    await contractRef.set({
      contractId: contractRef.id,
      orderId,
      templateId: template.templateId,
      templateKey: template.templateKey,
      snapshot: snapshotBase,
      pdfUrl,
      pdfStoragePath,
      generatedBy: claims.uid,
      generatedByName,
      version,
      // Sharing: ambos OFF por default. Admin activa explícitamente.
      clientUserId: order.userId ?? null,
      agentId: order.agentId ?? null,
      sharedWithClient: false,
      sharedWithAgent: false,
      acceptedAt: null,
      acceptedByUid: null,
      acceptedByName: null,
      acceptedIp: null,
      createdAt: FieldValue.serverTimestamp(),
    })

    // Backlink en la orden (latest)
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
