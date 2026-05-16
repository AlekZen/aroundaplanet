import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { adminDb } from '@/lib/firebase/admin'
import { folderMappingActionRequestSchema } from '@/schemas/odooDocumentMirrorSchema'
import {
  DOCUMENT_FOLDERS_COLLECTION,
  FOLDER_MAPPINGS_COLLECTION,
} from '@/lib/odoo/documents-pull'

/**
 * POST /api/odoo/documents/folder-mappings
 *
 * Story 8.1c — admin confirma, ignora o desrelaciona el mapping de un folder
 * Odoo. Persiste en `/odooDocumentFolderMappings/{folderId}` (set merge).
 *
 * Body: { folderId, action: 'confirm'|'ignore'|'unrelate', productId?, productName?, canonicalFolderId?, scopeOverride? }
 *
 * Idempotente — el doc se sobrescribe con merge en cada call.
 * NO escribe a Odoo. Requiere documents:manage.
 */
export async function POST(request: Request) {
  try {
    const claims = await requirePermission('documents:manage')

    let raw: unknown = {}
    try {
      const text = await request.text()
      if (text) raw = JSON.parse(text)
    } catch {
      throw new AppError('INVALID_REQUEST', 'Body JSON inválido', 400, false)
    }

    const parsed = folderMappingActionRequestSchema.safeParse(raw)
    if (!parsed.success) {
      throw new AppError(
        'INVALID_REQUEST',
        parsed.error.issues[0]?.message ?? 'Body inválido',
        400,
        false,
      )
    }

    const { folderId, action } = parsed.data

    // Guard: el folder debe existir en el mirror para evitar mappings huérfanos.
    const folderRef = adminDb.collection(DOCUMENT_FOLDERS_COLLECTION).doc(String(folderId))
    const folderSnap = await folderRef.get()
    if (!folderSnap.exists) {
      throw new AppError('NOT_FOUND', 'Folder mirror no encontrado', 404, false)
    }

    const mappingRef = adminDb
      .collection(FOLDER_MAPPINGS_COLLECTION)
      .doc(String(folderId))
    const existing = await mappingRef.get()
    const isNew = !existing.exists

    const statusByAction: Record<typeof action, 'confirmed' | 'dismissed' | 'auto'> = {
      confirm: 'confirmed',
      ignore: 'dismissed',
      unrelate: 'auto',
    }

    const update: Record<string, unknown> = {
      duplicateFolderId: folderId,
      // canonicalFolderId required cuando se confirma una relación de duplicado.
      // Si action !== 'confirm' o no se pasó canonical, dejamos el folderId mismo
      // (mapping self-referente == no es duplicado de nadie).
      canonicalFolderId: parsed.data.canonicalFolderId ?? folderId,
      status: statusByAction[action],
      detectedBy: 'admin-manual' as const,
      confidence: action === 'confirm' ? 100 : (existing.data()?.confidence ?? 0),
      confirmedBy: action === 'confirm' ? claims.uid : null,
      confirmedAt: action === 'confirm' ? FieldValue.serverTimestamp() : null,
      updatedAt: FieldValue.serverTimestamp(),
      action,
      relatedProductId: parsed.data.productId ?? null,
      relatedProductName: parsed.data.productName ?? null,
      scopeOverride: parsed.data.scopeOverride ?? null,
    }

    if (isNew) {
      update.createdAt = FieldValue.serverTimestamp()
    }

    await mappingRef.set(update, { merge: true })

    return NextResponse.json({ ok: true, folderId, action, created: isNew })
  } catch (error) {
    return handleApiError(error)
  }
}
