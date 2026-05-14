import { getStorage } from 'firebase-admin/storage'
import { AppError } from '@/lib/errors/AppError'

const KNOWN_HOSTS = {
  FIREBASESTORAGE: 'firebasestorage.googleapis.com',
  STORAGE_GOOGLEAPIS: 'storage.googleapis.com',
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

export interface DownloadedReceipt {
  buffer: Buffer
  mimetype: string
  /** Nombre canónico para Odoo: `comprobante-<firestoreId>.<ext>` */
  fileName: string
}

/**
 * Parsea un receiptUrl (3 shapes Firebase Storage) y devuelve { bucket, path }.
 * Lanza AppError si la URL no coincide con ninguno de los shapes conocidos.
 */
export function parseReceiptUrl(receiptUrl: string): { bucket: string; path: string } {
  if (!receiptUrl || typeof receiptUrl !== 'string') {
    throw new AppError('RECEIPT_INVALID_URL', 'receiptUrl vacío o no string', 400, false)
  }

  // Shape C: gs://
  if (receiptUrl.startsWith('gs://')) {
    const rest = receiptUrl.slice(5)
    const slashIdx = rest.indexOf('/')
    if (slashIdx < 0) {
      throw new AppError('RECEIPT_INVALID_URL', `gs:// sin path: ${receiptUrl}`, 400, false)
    }
    return { bucket: rest.slice(0, slashIdx), path: rest.slice(slashIdx + 1) }
  }

  let url: URL
  try {
    url = new URL(receiptUrl)
  } catch {
    throw new AppError('RECEIPT_INVALID_URL', `URL malformada: ${receiptUrl}`, 400, false)
  }

  // Shape A: firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded-path>
  if (url.hostname === KNOWN_HOSTS.FIREBASESTORAGE) {
    const m = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/)
    if (!m) {
      throw new AppError(
        'RECEIPT_INVALID_URL',
        `path firebasestorage no reconocido: ${url.pathname}`,
        400,
        false,
      )
    }
    return { bucket: m[1], path: decodeURIComponent(m[2]) }
  }

  // Shape B: storage.googleapis.com/<bucket>/<path>
  if (url.hostname === KNOWN_HOSTS.STORAGE_GOOGLEAPIS) {
    const m = url.pathname.match(/^\/([^/]+)\/(.+)$/)
    if (!m) {
      throw new AppError(
        'RECEIPT_INVALID_URL',
        `path storage.googleapis no reconocido: ${url.pathname}`,
        400,
        false,
      )
    }
    return { bucket: m[1], path: m[2] }
  }

  throw new AppError('RECEIPT_INVALID_URL', `hostname desconocido: ${url.hostname}`, 400, false)
}

/**
 * Infiere el mimetype a partir de metadata del archivo o del sufijo del path.
 * Prefiere `metadataContentType` salvo que sea genérico (`application/octet-stream`).
 */
export function inferMimetype(opts: {
  metadataContentType?: string | null
  path: string
}): string {
  if (
    opts.metadataContentType &&
    opts.metadataContentType.length > 0 &&
    opts.metadataContentType !== 'application/octet-stream'
  ) {
    return opts.metadataContentType
  }
  const ext = opts.path.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

/**
 * Descarga el comprobante desde Firebase Storage dado un receiptUrl.
 * Usa el Admin SDK para acceso autenticado (bypass de ACL públicas).
 * Genera un fileName canónico `comprobante-<firestoreId>.<ext>` listo para adjuntar a Odoo.
 *
 * @param receiptUrl URL del comprobante en Storage (shapes A, B o C soportados)
 * @param firestoreId ID del pago en Firestore — usado para el nombre canónico
 */
export async function downloadReceiptFromUrl(
  receiptUrl: string,
  firestoreId: string,
): Promise<DownloadedReceipt> {
  const { bucket: bucketName, path } = parseReceiptUrl(receiptUrl)

  const fileRef = getStorage().bucket(bucketName).file(path)

  let exists: boolean
  try {
    ;[exists] = await fileRef.exists()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new AppError('RECEIPT_DOWNLOAD_FAILED', `Storage exists() falló: ${msg}`, 502, true)
  }

  if (!exists) {
    throw new AppError('RECEIPT_NOT_FOUND', `Archivo no existe en Storage: ${path}`, 404, false)
  }

  // Intentar leer metadata para inferir mimetype; si falla, continua con sufijo
  let metadataContentType: string | null = null
  try {
    const [meta] = await fileRef.getMetadata()
    metadataContentType = typeof meta.contentType === 'string' ? meta.contentType : null
  } catch {
    // best-effort: si falla, el mimetype se infiere del sufijo del path
  }

  let buffer: Buffer
  try {
    const [bytes] = await fileRef.download()
    buffer = bytes
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new AppError('RECEIPT_DOWNLOAD_FAILED', `Storage download() falló: ${msg}`, 502, true)
  }

  const mimetype = inferMimetype({ metadataContentType, path })
  const ext = (path.split('.').pop() ?? 'bin').toLowerCase()
  const fileName = `comprobante-${firestoreId}.${ext}`

  return { buffer, mimetype, fileName }
}
