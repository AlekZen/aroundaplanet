import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'
import { fetchOdooDocumentsOverview } from '@/lib/odoo/models/documents'
import type { UserRole } from '@/types/user'

function canManageDocuments(roles: readonly UserRole[]) {
  return roles.includes('admin') || roles.includes('superadmin')
}

export async function POST() {
  try {
    const claims = await requireAuth()
    if (!canManageDocuments(claims.roles)) {
      throw new AppError('INSUFFICIENT_PERMISSION', 'Solo Admin y SuperAdmin pueden sincronizar documentos Odoo', 403, false)
    }

    const overview = await fetchOdooDocumentsOverview()
    return NextResponse.json({
      total: overview.counts.productDocuments + overview.counts.folders + overview.counts.backofficeDocuments,
      created: 0,
      updated: overview.counts.productDocuments + overview.counts.folders + overview.counts.backofficeDocuments,
      errors: 0,
      syncedAt: overview.generatedAt,
      counts: overview.counts,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
