import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { adminDb } from '@/lib/firebase/admin'
import { documentMarkUnrelatedRequestSchema } from '@/schemas/odooDocumentMirrorSchema'
import { DOCUMENTS_COLLECTION } from '@/lib/odoo/documents-pull'

type RouteParams = { params: Promise<{ documentId: string }> }

/**
 * POST /api/odoo/documents/[documentId]/mark-unrelated
 *
 * Story 8.1c — marca un documento como deliberadamente no-relacionado. Setea
 * `adminOverride.markedUnrelated=true` y `adminOverride.scope='unmatched'`.
 * Idempotente. Requiere documents:manage.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const claims = await requirePermission('documents:manage')
    const { documentId } = await params
    const id = Number.parseInt(documentId, 10)
    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError('VALIDATION_ERROR', 'documentId inválido', 400, false)
    }

    let raw: unknown = {}
    try {
      const text = await request.text()
      if (text) raw = JSON.parse(text)
    } catch {
      raw = {}
    }

    const parsed = documentMarkUnrelatedRequestSchema.safeParse(raw)
    if (!parsed.success) {
      throw new AppError(
        'INVALID_REQUEST',
        parsed.error.issues[0]?.message ?? 'Body inválido',
        400,
        false,
      )
    }

    const ref = adminDb.collection(DOCUMENTS_COLLECTION).doc(String(id))
    const snap = await ref.get()
    if (!snap.exists) {
      throw new AppError('NOT_FOUND', 'Documento mirror no encontrado', 404, false)
    }

    const override = {
      markedUnrelated: true,
      markedUnrelatedReason: parsed.data.reason ?? null,
      scope: 'unmatched' as const,
      updatedBy: claims.uid,
      updatedAt: FieldValue.serverTimestamp(),
    }

    await ref.set({ adminOverride: override }, { merge: true })

    return NextResponse.json({ ok: true, documentId: id })
  } catch (error) {
    return handleApiError(error)
  }
}
