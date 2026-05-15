import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'
import { quotationLeadSnapshotSchema } from '@/schemas/quotationSchema'
import { renderAndUploadQuotation } from '@/lib/pdf/quotations/generate'

export const runtime = 'nodejs'
export const maxDuration = 30

const COLLECTION = 'quotations'

/**
 * POST /api/quotations/[quotationId]/generate
 * Admin/superadmin/director regenera PDF de la cotización (versionado in-place).
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ quotationId: string }> }
) {
  try {
    const claims = await requireAuth()
    const roles = claims.roles ?? []
    if (!roles.some((r) => r === 'admin' || r === 'superadmin' || r === 'director')) {
      throw new AppError('FORBIDDEN', 'Requiere rol admin/superadmin/director', 403)
    }

    const { quotationId } = await context.params
    if (!quotationId) throw new AppError('VALIDATION_ERROR', 'quotationId requerido', 400)

    const ref = adminDb.collection(COLLECTION).doc(quotationId)
    const snap = await ref.get()
    if (!snap.exists) throw new AppError('QUOTATION_NOT_FOUND', 'Cotización no encontrada', 404)

    const data = snap.data()!
    const leadParsed = quotationLeadSnapshotSchema.safeParse(data.leadSnapshot)
    if (!leadParsed.success) {
      throw new AppError(
        'QUOTATION_INVALID',
        leadParsed.error.issues[0]?.message ?? 'Cotización con datos inválidos',
        422
      )
    }

    const generatedAtIso = new Date().toISOString()
    const { pdfUrl, pdfStoragePath } = await renderAndUploadQuotation({
      quotationId,
      lead: leadParsed.data,
      generatedAtIso,
    })

    const newVersion = Number(data.pdfVersion ?? 0) + 1

    await ref.update({
      pdfUrl,
      pdfStoragePath,
      pdfVersion: newVersion,
      pdfGeneratedAt: FieldValue.serverTimestamp(),
      pdfGeneratedBy: claims.uid,
      status: 'pdf-generated',
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ quotationId, pdfUrl, pdfVersion: newVersion })
  } catch (error) {
    return handleApiError(error)
  }
}
