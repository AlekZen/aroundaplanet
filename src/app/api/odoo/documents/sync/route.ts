import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { fetchOdooDocumentsOverview } from '@/lib/odoo/models/documents'

export async function POST() {
  try {
    await requirePermission('documents:manage')

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
