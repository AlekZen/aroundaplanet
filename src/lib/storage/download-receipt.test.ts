import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors/AppError'

// --- Mock firebase-admin/storage ---
const fileMock = {
  exists: vi.fn(),
  getMetadata: vi.fn(),
  download: vi.fn(),
}
const fileFn = vi.fn(() => fileMock)
const bucketMock = vi.fn(() => ({ file: fileFn }))

vi.mock('firebase-admin/storage', () => ({
  getStorage: () => ({ bucket: bucketMock }),
}))

// Importar después del mock
import { parseReceiptUrl, inferMimetype, downloadReceiptFromUrl } from './download-receipt'

// ---------------------------------------------------------------------------
// parseReceiptUrl
// ---------------------------------------------------------------------------
describe('parseReceiptUrl', () => {
  describe('Shape A — firebasestorage.googleapis.com (URL firmada)', () => {
    it('extrae bucket y path con segmentos encoded', () => {
      const url =
        'https://firebasestorage.googleapis.com/v0/b/arounda-planet.firebasestorage.app/o/receipts%2Fabc123%2Frecibo.pdf?alt=media&token=tok'
      const result = parseReceiptUrl(url)
      expect(result).toEqual({
        bucket: 'arounda-planet.firebasestorage.app',
        path: 'receipts/abc123/recibo.pdf',
      })
    })

    it('decodifica correctamente %2F dentro del path', () => {
      const url =
        'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/a%2Fb%2Fc.jpg?alt=media'
      const { path } = parseReceiptUrl(url)
      expect(path).toBe('a/b/c.jpg')
    })
  })

  describe('Shape B — storage.googleapis.com (URL pública)', () => {
    it('extrae bucket y path sin encoding', () => {
      const url =
        'https://storage.googleapis.com/arounda-planet.firebasestorage.app/receipts/abc123/recibo.pdf'
      const result = parseReceiptUrl(url)
      expect(result).toEqual({
        bucket: 'arounda-planet.firebasestorage.app',
        path: 'receipts/abc123/recibo.pdf',
      })
    })
  })

  describe('Shape C — gs://', () => {
    it('extrae bucket y path de gs://', () => {
      const url = 'gs://arounda-planet.firebasestorage.app/receipts/abc123/recibo.pdf'
      const result = parseReceiptUrl(url)
      expect(result).toEqual({
        bucket: 'arounda-planet.firebasestorage.app',
        path: 'receipts/abc123/recibo.pdf',
      })
    })

    it('lanza AppError si gs:// no tiene path', () => {
      expect(() => parseReceiptUrl('gs://solo-bucket')).toThrow(AppError)
    })
  })

  describe('URLs inválidas', () => {
    it('lanza AppError RECEIPT_INVALID_URL para hostname desconocido', () => {
      const err = (() => {
        try {
          parseReceiptUrl('https://example.com/foo.pdf')
        } catch (e) {
          return e
        }
      })() as AppError
      expect(err).toBeInstanceOf(AppError)
      expect(err.code).toBe('RECEIPT_INVALID_URL')
      expect(err.retryable).toBe(false)
    })

    it('lanza AppError para string vacío', () => {
      expect(() => parseReceiptUrl('')).toThrow(AppError)
    })

    it('lanza AppError para URL malformada', () => {
      expect(() => parseReceiptUrl('no-es-una-url')).toThrow(AppError)
    })
  })
})

// ---------------------------------------------------------------------------
// inferMimetype
// ---------------------------------------------------------------------------
describe('inferMimetype', () => {
  it('retorna el metadataContentType cuando es válido y específico', () => {
    expect(inferMimetype({ metadataContentType: 'application/pdf', path: 'foo.png' })).toBe(
      'application/pdf',
    )
  })

  it('cae al sufijo cuando metadataContentType es null', () => {
    expect(inferMimetype({ metadataContentType: null, path: 'foto.JPG' })).toBe('image/jpeg')
  })

  it('cae al sufijo cuando metadataContentType es application/octet-stream', () => {
    expect(
      inferMimetype({ metadataContentType: 'application/octet-stream', path: 'recibo.pdf' }),
    ).toBe('application/pdf')
  })

  it('retorna application/octet-stream para extensión desconocida sin metadata útil', () => {
    expect(inferMimetype({ metadataContentType: null, path: 'archivo.xyz' })).toBe(
      'application/octet-stream',
    )
  })

  it('soporta extensiones en mayúsculas (JPG)', () => {
    expect(inferMimetype({ metadataContentType: null, path: 'FOTO.JPEG' })).toBe('image/jpeg')
  })
})

// ---------------------------------------------------------------------------
// downloadReceiptFromUrl
// ---------------------------------------------------------------------------
describe('downloadReceiptFromUrl', () => {
  const RECEIPT_URL =
    'https://firebasestorage.googleapis.com/v0/b/arounda-planet.firebasestorage.app/o/receipts%2Fabc123%2Frecibo.pdf?alt=media&token=tok'
  const FIRESTORE_ID = 'abc123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('descarga y retorna buffer, mimetype y fileName canónico', async () => {
    fileMock.exists.mockResolvedValue([true])
    fileMock.getMetadata.mockResolvedValue([{ contentType: 'application/pdf' }])
    const fakeBuffer = Buffer.from('fake-pdf-bytes')
    fileMock.download.mockResolvedValue([fakeBuffer])

    const result = await downloadReceiptFromUrl(RECEIPT_URL, FIRESTORE_ID)

    expect(result.buffer).toBe(fakeBuffer)
    expect(result.mimetype).toBe('application/pdf')
    expect(result.fileName).toBe('comprobante-abc123.pdf')
  })

  it('lanza AppError RECEIPT_NOT_FOUND (404, retryable=false) si el archivo no existe', async () => {
    fileMock.exists.mockResolvedValue([false])

    const err = await downloadReceiptFromUrl(RECEIPT_URL, FIRESTORE_ID).catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('RECEIPT_NOT_FOUND')
    expect(err.status).toBe(404)
    expect(err.retryable).toBe(false)
  })

  it('lanza AppError RECEIPT_DOWNLOAD_FAILED (502, retryable=true) si download() falla', async () => {
    fileMock.exists.mockResolvedValue([true])
    fileMock.getMetadata.mockResolvedValue([{ contentType: 'application/pdf' }])
    fileMock.download.mockRejectedValue(new Error('red caída'))

    const err = await downloadReceiptFromUrl(RECEIPT_URL, FIRESTORE_ID).catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('RECEIPT_DOWNLOAD_FAILED')
    expect(err.status).toBe(502)
    expect(err.retryable).toBe(true)
  })

  it('usa fallback al sufijo si getMetadata() falla pero download() funciona', async () => {
    fileMock.exists.mockResolvedValue([true])
    fileMock.getMetadata.mockRejectedValue(new Error('IAM denegado'))
    const fakeBuffer = Buffer.from('fake-pdf-bytes')
    fileMock.download.mockResolvedValue([fakeBuffer])

    const result = await downloadReceiptFromUrl(RECEIPT_URL, FIRESTORE_ID)
    expect(result.mimetype).toBe('application/pdf') // inferido del sufijo .pdf
    expect(result.buffer).toBe(fakeBuffer)
  })

  it('lanza AppError RECEIPT_DOWNLOAD_FAILED si exists() lanza excepción', async () => {
    fileMock.exists.mockRejectedValue(new Error('timeout'))

    const err = await downloadReceiptFromUrl(RECEIPT_URL, FIRESTORE_ID).catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('RECEIPT_DOWNLOAD_FAILED')
    expect(err.retryable).toBe(true)
  })

  it('genera fileName con extensión correcta para imagen PNG', async () => {
    const pngUrl =
      'https://storage.googleapis.com/arounda-planet.firebasestorage.app/receipts/xyz/foto.png'
    fileMock.exists.mockResolvedValue([true])
    fileMock.getMetadata.mockResolvedValue([{ contentType: 'image/png' }])
    fileMock.download.mockResolvedValue([Buffer.from('png')])

    const result = await downloadReceiptFromUrl(pngUrl, 'xyz')
    expect(result.fileName).toBe('comprobante-xyz.png')
    expect(result.mimetype).toBe('image/png')
  })

  it('usa el bucket correcto extraído de la URL', async () => {
    fileMock.exists.mockResolvedValue([true])
    fileMock.getMetadata.mockResolvedValue([{ contentType: 'application/pdf' }])
    fileMock.download.mockResolvedValue([Buffer.from('x')])

    await downloadReceiptFromUrl(RECEIPT_URL, FIRESTORE_ID)
    expect(bucketMock).toHaveBeenCalledWith('arounda-planet.firebasestorage.app')
  })
})
