import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { adminDb } from '@/lib/firebase/admin'
import { documentPatchRequestSchema } from '@/schemas/odooDocumentMirrorSchema'
import { DOCUMENTS_COLLECTION } from '@/lib/odoo/documents-pull'

type RouteParams = { params: Promise<{ documentId: string }> }

/**
 * PATCH /api/odoo/documents/[documentId]
 *
 * Story 8.1c — actualiza overrides admin sobre un mirror `odooDocuments/{id}`.
 * NO escribe a Odoo. Persiste en `adminOverride` nested para que el pull NO sobrescriba.
 *
 * Body: { scopeOverride?, relatedProductId?, relatedProductName? }
 * Requiere permiso documents:manage.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
      throw new AppError('INVALID_REQUEST', 'Body JSON inválido', 400, false)
    }

    const parsed = documentPatchRequestSchema.safeParse(raw)
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

    const override: Record<string, unknown> = {
      updatedBy: claims.uid,
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (parsed.data.scopeOverride !== undefined) {
      override.scope = parsed.data.scopeOverride
    }
    if (parsed.data.relatedProductId !== undefined) {
      override.relatedProductId = parsed.data.relatedProductId
    }
    if (parsed.data.relatedProductName !== undefined) {
      override.relatedProductName = parsed.data.relatedProductName
    }

    await ref.set({ adminOverride: override }, { merge: true })

    return NextResponse.json({ ok: true, documentId: id, adminOverride: override })
  } catch (error) {
    return handleApiError(error)
  }
}
