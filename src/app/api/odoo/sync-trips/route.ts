import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { syncTrips } from '@/lib/odoo/sync/trip-sync'
import { tripSyncOptionsSchema } from '@/schemas/tripSchema'

export async function POST(request: NextRequest) {
  try {
    const claims = await requirePermission('sync:odoo')

    const body = await request.json().catch(() => ({}))
    const parsed = tripSyncOptionsSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Input invalido', retryable: false },
        { status: 400 },
      )
    }

    const result = await syncTrips(parsed.data, claims.uid)

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
