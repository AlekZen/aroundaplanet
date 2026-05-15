import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'

export const runtime = 'nodejs'

/**
 * Story 10.1.2 — Mirror Odoo sale.order → Firestore orders.
 *
 * Cuando el admin quiere generar un contrato para una venta de Odoo
 * (que aparece en /admin/trips/[tripId] sección Ventas), llama este endpoint
 * para crear/actualizar la orden Firestore mirror con docId="odoo-sale-{saleOrderId}".
 * Idempotente: si ya existe, hace merge de campos.
 */
const inputSchema = z.object({
  saleOrderId: z.number().int().positive(),
  saleOrderName: z.string().max(64).nullable().optional(),
  customerName: z.string().trim().min(2).max(200),
  customerPhone: z.string().trim().max(64).nullable().optional(),
  customerEmail: z.string().trim().email().max(200).nullable().optional(),
  agentId: z.string().max(128).nullable().optional(),
  agentName: z.string().max(200).nullable().optional(),
  tripId: z.string().max(128).nullable().optional(),
  tripName: z.string().max(200).nullable().optional(),
  amountTotalCents: z.number().int().nonnegative(),
  amountPaidCents: z.number().int().nonnegative().optional().default(0),
  status: z
    .enum(['Interesado', 'Confirmado', 'En Progreso', 'Completado', 'Cancelado'])
    .optional()
    .default('Confirmado'),
})

export async function POST(request: NextRequest) {
  try {
    const claims = await requireAuth()
    const roles = claims.roles ?? []
    if (!roles.some((r) => r === 'admin' || r === 'superadmin' || r === 'director')) {
      throw new AppError('FORBIDDEN', 'Requiere rol admin/superadmin/director', 403)
    }

    const body = await request.json().catch(() => ({}))
    const parsed = inputSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Datos inválidos',
        400
      )
    }
    const data = parsed.data
    const docId = `odoo-sale-${data.saleOrderId}`
    const ref = adminDb.collection('orders').doc(docId)
    const existing = await ref.get()

    const payload: Record<string, unknown> = {
      odooSaleOrderId: data.saleOrderId,
      odooSaleOrderName: data.saleOrderName ?? null,
      source: 'odoo-sale-mirror',
      contactName: data.customerName,
      contactPhone: data.customerPhone ?? null,
      contactEmail: data.customerEmail ?? null,
      agentId: data.agentId ?? null,
      agentName: data.agentName ?? null,
      tripId: data.tripId ?? null,
      tripName: data.tripName ?? null,
      status: data.status,
      amountTotalCents: data.amountTotalCents,
      amountPaidCents: data.amountPaidCents,
      userId: null,
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (!existing.exists) {
      payload.createdAt = FieldValue.serverTimestamp()
      payload.createdBy = claims.uid
      payload.createdBySource = 'admin-odoo-mirror'
    }

    await ref.set(payload, { merge: true })

    return NextResponse.json(
      { orderId: docId, created: !existing.exists },
      { status: existing.exists ? 200 : 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
