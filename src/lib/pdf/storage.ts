import { getStorage } from 'firebase-admin/storage'

/**
 * Story 10.1 — Upload helper para PDFs (contratos + cotizaciones).
 *
 * Decisión seguridad (Alek/advisor sesión 43): los PDFs contienen datos sensibles
 * (nombre cliente, montos, datos bancarios de la agencia). NO usamos `makePublic`.
 * El bucket queda con `storage.rules` cerrado y servimos vía signed URL (7 días)
 * generada desde la service account.
 */
const SIGNED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function uploadPdfBuffer(
  storagePath: string,
  buffer: Buffer
): Promise<{ url: string; path: string }> {
  const bucket = getStorage().bucket()
  const fileRef = bucket.file(storagePath)
  await fileRef.save(buffer, {
    metadata: {
      contentType: 'application/pdf',
      cacheControl: 'private, max-age=3600',
    },
  })

  const [url] = await fileRef.getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_MS,
    version: 'v4',
  })

  return { url, path: storagePath }
}

/**
 * Regenera signed URL para un PDF existente sin re-renderizar.
 * Útil cuando expira la URL persistida en Firestore.
 */
export async function refreshSignedUrl(storagePath: string): Promise<string> {
  const bucket = getStorage().bucket()
  const fileRef = bucket.file(storagePath)
  const [url] = await fileRef.getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_MS,
    version: 'v4',
  })
  return url
}
