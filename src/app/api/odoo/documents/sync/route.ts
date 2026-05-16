import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { syncOdooDocuments, DocumentsSyncLockError } from '@/lib/odoo/documents-pull'
import { documentsSyncRequestSchema } from '@/schemas/odooDocumentMirrorSchema'

export async function POST(request: Request) {
  try {
    await requirePermission('documents:manage')

    // Body opcional
    let body: unknown = {}
    try {
      const text = await request.text()
      if (text) body = JSON.parse(text)
    } catch {
      body = {}
    }

    const parsed = documentsSyncRequestSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError('INVALID_REQUEST', 'Body inválido', 400, false)
    }

    const summary = await syncOdooDocuments({
      since: parsed.data.since,
      dryRun: parsed.data.dryRun,
      batchSize: parsed.data.batchSize,
      full: parsed.data.full,
    })

    return NextResponse.json(summary)
  } catch (error) {
    if (error instanceof DocumentsSyncLockError) {
      return NextResponse.json(
        {
          code: 'ALREADY_SYNCING',
          message: error.message,
          currentRunId: error.currentRunId,
        },
        { status: 409 },
      )
    }
    return handleApiError(error)
  }
}
