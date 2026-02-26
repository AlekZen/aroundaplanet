import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { handleApiError } from '@/lib/errors/handleApiError'
import { getOdooClient } from '@/lib/odoo/client'
import { withCacheFallback } from '@/lib/odoo/cache'
import { odooSearchReadSchema } from '@/schemas/odooSchema'
import type { OdooDomain } from '@/types/odoo'

export async function POST(request: NextRequest) {
  try {
    await requireRole('admin')
    const body = await request.json()
    const { model, domain, fields, limit, offset, order } = odooSearchReadSchema.parse(body)
    const client = getOdooClient()
    const cacheKey = JSON.stringify({ domain, fields, limit, offset, order })
    const result = await withCacheFallback(model, cacheKey, () =>
      client.searchRead(model, domain as OdooDomain, fields, { limit, offset, order })
    )
    return NextResponse.json(result.data)
  } catch (error) {
    return handleApiError(error)
  }
}
