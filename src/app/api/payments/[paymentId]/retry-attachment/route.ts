import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'

interface RouteContext {
  params: Promise<{ paymentId: string }>
}

/**
 * POST /api/payments/[paymentId]/retry-attachment
 * Placeholder — implementación pendiente Story 9.4 (adjuntos individuales ir.attachment).
 * Requiere permiso payments:verify (admin/superadmin).
 */
export async function POST(_request: NextRequest, _context: RouteContext) {
  try {
    await requirePermission('payments:verify')

    return NextResponse.json(
      {
        code: 'not_implemented',
        message: 'Pendiente Story 9.4 - retry attachment',
        storyDeps: ['9.4'],
      },
      { status: 501 },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
