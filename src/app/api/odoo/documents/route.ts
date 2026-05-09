import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'
import { fetchOdooDocumentsOverview } from '@/lib/odoo/models/documents'
import type { UserRole } from '@/types/user'

function canReadDocuments(roles: readonly UserRole[]) {
  return roles.includes('admin') || roles.includes('superadmin')
}

export async function GET(request: Request) {
  try {
    const claims = await requireAuth()
    if (!canReadDocuments(claims.roles)) {
      throw new AppError('INSUFFICIENT_PERMISSION', 'Solo Admin y SuperAdmin pueden ver documentos Odoo', 403, false)
    }

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
