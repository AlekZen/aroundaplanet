import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { getOdooClient } from '@/lib/odoo/client'

type RouteParams = { params: Promise<{ attachmentId: string }> }

/** Extended timeout for large file downloads (30s vs default 5s) */
const DOWNLOAD_TIMEOUT_MS = 30_000

/**
 * GET /api/odoo/documents/[attachmentId]
 * Proxy: reads binary from ir.attachment via OdooClient (rate-limited).
 * Requires trips:read permission.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission('trips:read')
    const { attachmentId } = await params
    const id = parseInt(attachmentId, 10)

    if (isNaN(id) || id <= 0) {
      throw new AppError('VALIDATION_ERROR', 'ID de adjunto invalido', 400, false)
    }

    const client = getOdooClient()
    const records = await client.read(
      'ir.attachment',
      [id],
      ['name', 'mimetype', 'file_size', 'datas'],
      { timeoutMs: DOWNLOAD_TIMEOUT_MS },
    )

    if (records.length === 0) {
      throw new AppError('ODOO_NOT_FOUND', 'Documento no encontrado en Odoo', 404, false)
    }

    const record = records[0]
    const base64Data = record.datas as string | false

    if (!base64Data) {
      throw new AppError('ODOO_NOT_FOUND', 'Documento sin contenido', 404, false)
    }

    const mimetype = (record.mimetype as string) || 'application/octet-stream'
    const filename = (record.name as string) || 'documento'
    const buffer = Buffer.from(base64Data, 'base64')

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimetype,
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
