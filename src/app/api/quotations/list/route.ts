import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'
import { QUOTATION_STATUSES } from '@/schemas/quotationSchema'

export const runtime = 'nodejs'

/**
 * GET /api/quotations/list — Lista paginada para `/admin/quotations`.
 * Query: status (opcional), pageSize (default 20), cursor (last doc id).
 */
export async function GET(request: NextRequest) {
  try {
    const claims = await requireAuth()
    const roles = claims.roles ?? []
    if (!roles.some((r) => r === 'admin' || r === 'superadmin' || r === 'director')) {
      throw new AppError('FORBIDDEN', 'Requiere rol admin/superadmin/director', 403)
    }

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') ?? 20), 1), 100)
    const cursor = searchParams.get('cursor')

    let q: FirebaseFirestore.Query = adminDb.collection('quotations').orderBy('createdAt', 'desc')
    if (status && (QUOTATION_STATUSES as readonly string[]).includes(status)) {
      q = q.where('status', '==', status)
    }
    if (cursor) {
      const cursorSnap = await adminDb.collection('quotations').doc(cursor).get()
      if (cursorSnap.exists) q = q.startAfter(cursorSnap)
    }

    const snap = await q.limit(pageSize + 1).get()
    const docs = snap.docs.slice(0, pageSize)
    const hasMore = snap.docs.length > pageSize
    const nextCursor = hasMore ? docs[docs.length - 1]?.id ?? null : null

    const quotations = docs.map((d) => {
      const data = d.data()
      return {
        quotationId: d.id,
        source: data.source ?? 'cotizar-public',
        status: data.status ?? 'lead',
        leadSnapshot: data.leadSnapshot ?? null,
        pdfUrl: data.pdfUrl ?? null,
        pdfVersion: data.pdfVersion ?? 0,
        whatsappSent: data.whatsappSent ?? false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        pdfGeneratedAt: data.pdfGeneratedAt?.toDate?.()?.toISOString() ?? null,
      }
    })

    return NextResponse.json({ quotations, nextCursor })
  } catch (error) {
    return handleApiError(error)
  }
}
