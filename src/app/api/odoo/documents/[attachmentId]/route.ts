import { NextRequest, NextResponse } from 'next/server'
import xmlrpc from 'xmlrpc'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'

type RouteParams = { params: Promise<{ attachmentId: string }> }

/** Extended timeout for large file downloads (30s vs default 5s) */
const DOWNLOAD_TIMEOUT_MS = 30_000

/**
 * GET /api/odoo/documents/[attachmentId]
 * Proxy: reads binary from ir.attachment via XML-RPC with extended timeout.
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

    const url = process.env.ODOO_URL
    const db = process.env.ODOO_DB
    const username = process.env.ODOO_USERNAME
    const apiKey = process.env.ODOO_API_KEY

    if (!url || !db || !username || !apiKey) {
      throw new AppError('ODOO_AUTH_FAILED', 'Faltan variables de entorno Odoo', 500, false)
    }

    const urlObj = new URL(url)

    // Authenticate
    const uid = await new Promise<number>((resolve, reject) => {
      const client = xmlrpc.createSecureClient({
        host: urlObj.hostname,
        port: Number(urlObj.port) || 443,
        path: '/xmlrpc/2/common',
      })
      const timeout = setTimeout(() => reject(new AppError('ODOO_TIMEOUT', 'Autenticacion timeout', 503, true)), 10_000)
      client.methodCall('authenticate', [db, username, apiKey, {}], (err, value) => {
        clearTimeout(timeout)
        if (err) return reject(new AppError('ODOO_AUTH_FAILED', 'Error autenticacion Odoo', 401, false))
        if (!value || typeof value !== 'number') return reject(new AppError('ODOO_AUTH_FAILED', 'Credenciales invalidas', 401, false))
        resolve(value)
      })
    })

    // Read attachment with extended timeout
    const records = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      const client = xmlrpc.createSecureClient({
        host: urlObj.hostname,
        port: Number(urlObj.port) || 443,
        path: '/xmlrpc/2/object',
      })
      const timeout = setTimeout(
        () => reject(new AppError('ODOO_TIMEOUT', 'Descarga de documento timeout (archivo muy grande)', 503, true)),
        DOWNLOAD_TIMEOUT_MS,
      )
      client.methodCall(
        'execute_kw',
        [db, uid, apiKey, 'ir.attachment', 'read', [[id]], { fields: ['name', 'mimetype', 'file_size', 'datas'] }],
        (err, value) => {
          clearTimeout(timeout)
          if (err) return reject(new AppError('ODOO_UNAVAILABLE', `Error Odoo: ${String(err)}`, 500, true))
          resolve(value as Array<Record<string, unknown>>)
        },
      )
    })

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
