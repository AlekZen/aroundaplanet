import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { fetchOdooDocumentsOverview } from '@/lib/odoo/models/documents'

export async function GET(request: Request) {
  try {
    await requirePermission('documents:read')

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')
    const overview = await fetchOdooDocumentsOverview(
      mode === 'full'
        ? {}
        : {
            productLimit: 800,
            productDocumentLimit: 500,
            folderLimit: 250,
            backofficeDocumentLimit: 500,
          },
    )
    return NextResponse.json(overview)
  } catch (error) {
    return handleApiError(error)
  }
}
