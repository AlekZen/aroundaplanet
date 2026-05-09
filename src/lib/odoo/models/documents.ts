import { getOdooClient } from '@/lib/odoo/client'
import { normalizeOdooDocumentName } from '@/schemas/odooDocumentsSchema'
import type { OdooRecord } from '@/types/odoo'
import type {
  OdooBackofficeDocumentItem,
  OdooDocumentFolderItem,
  OdooDocumentScope,
  OdooDocumentsOverview,
  OdooProductDocumentItem,
} from '@/types/odooDocuments'

const PRODUCT_DOCUMENT_FIELDS = [
  'name',
  'mimetype',
  'file_size',
  'res_id',
  'res_name',
  'shown_on_product_page',
  'attached_on_sale',
  'ir_attachment_id',
  'write_date',
] as const

const DOCUMENTS_MODULE_FIELDS = [
  'name',
  'type',
  'mimetype',
  'file_size',
  'folder_id',
  'res_model',
  'res_id',
  'res_name',
  'attachment_id',
  'write_date',
] as const

const PRODUCT_FIELDS = ['id', 'name', 'type', 'list_price', 'active'] as const

interface FetchOdooDocumentsOverviewOptions {
  productLimit?: number
  productDocumentLimit?: number
  folderLimit?: number
  backofficeDocumentLimit?: number
}

function many2oneId(value: unknown): number | null {
  return Array.isArray(value) && typeof value[0] === 'number' ? value[0] : null
}

function many2oneName(value: unknown): string | null {
  return Array.isArray(value) && typeof value[1] === 'string' ? value[1] : null
}

function asStringOrFalse(value: unknown): string | false {
  return typeof value === 'string' ? value : false
}

function classifyFolder(path: string, relationStatus: 'linked' | 'suggested' | 'unmatched'): OdooDocumentScope {
  const normalized = normalizeOdooDocumentName(path)
  if (normalized.includes('pago')) return 'payment'
  if (normalized.includes('venta')) return 'sales'
  if (normalized.includes('cotizacion')) return 'quote'
  if (normalized.includes('cupon')) return 'coupon'
  if (normalized.includes('contrato')) return 'contract'
  if (normalized.includes('itinerario') || normalized.includes('flyer')) return relationStatus === 'unmatched' ? 'internal' : 'trip-backoffice'
  if (relationStatus !== 'unmatched') return 'trip-backoffice'
  return 'unmatched'
}

function matchFolderToProduct(
  folderName: string,
  products: OdooRecord[],
): { status: 'linked' | 'suggested' | 'unmatched'; productId: number | null; productName: string | null; confidence: number; reason: string | null } {
  const normalizedFolder = normalizeOdooDocumentName(folderName)
  if (!normalizedFolder) {
    return { status: 'unmatched', productId: null, productName: null, confidence: 0, reason: 'missing-folder-name' }
  }

  const productNames = products.map((product) => ({
    id: product.id,
    name: String(product.name ?? ''),
    normalized: normalizeOdooDocumentName(product.name),
  }))

  const exact = productNames.find((product) => product.normalized === normalizedFolder)
  if (exact) {
    return { status: 'linked', productId: exact.id, productName: exact.name, confidence: 100, reason: null }
  }

  const folderTokens = normalizedFolder.split(' ').filter((token) => token.length > 3)
  const scored = productNames
    .map((product) => {
      const productTokens = product.normalized.split(' ').filter((token) => token.length > 3)
      const overlap = folderTokens.filter((token) => productTokens.includes(token)).length
      const contained = product.normalized.includes(normalizedFolder) || normalizedFolder.includes(product.normalized)
      return { ...product, score: contained ? 80 : overlap * 20 }
    })
    .filter((product) => product.score >= 60)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 1) {
    return { status: 'suggested', productId: scored[0].id, productName: scored[0].name, confidence: scored[0].score, reason: null }
  }

  if (scored.length > 1) {
    return { status: 'unmatched', productId: null, productName: null, confidence: scored[0].score, reason: 'ambiguous-match' }
  }

  const operational = ['pago', 'venta', 'cotizacion', 'cupon', 'contrato'].some((token) => normalizedFolder.includes(token))
  return { status: 'unmatched', productId: null, productName: null, confidence: 0, reason: operational ? 'operational-folder' : 'no-product-match' }
}

function buildFolderPath(folder: OdooRecord, folderById: Map<number, OdooRecord>): string {
  const names: string[] = [String(folder.name ?? 'Sin nombre')]
  let parentId = many2oneId(folder.folder_id)
  const seen = new Set<number>()

  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = folderById.get(parentId)
    if (!parent) break
    names.unshift(String(parent.name ?? 'Sin nombre'))
    parentId = many2oneId(parent.folder_id)
  }

  return names.join(' / ')
}

export async function fetchOdooDocumentsOverview(options: FetchOdooDocumentsOverviewOptions = {}): Promise<OdooDocumentsOverview> {
  const client = getOdooClient()
  const productLimit = options.productLimit ?? 3000
  const productDocumentLimit = options.productDocumentLimit ?? 2000
  const folderLimit = options.folderLimit ?? 500
  const backofficeDocumentLimit = options.backofficeDocumentLimit ?? 1500

  const [products, productDocuments, folders, backofficeDocuments] = await Promise.all([
    client.searchRead('product.template', [['type', '=', 'service']], [...PRODUCT_FIELDS], { limit: productLimit, order: 'name asc' }),
    client.searchRead(
      'product.document',
      [['res_model', '=', 'product.template'], ['active', '=', true]],
      [...PRODUCT_DOCUMENT_FIELDS],
      { limit: productDocumentLimit, order: 'id desc' },
    ),
    client.searchRead(
      'documents.document',
      [['type', '=', 'folder']],
      [...DOCUMENTS_MODULE_FIELDS],
      { limit: folderLimit, order: 'id asc' },
    ),
    client.searchRead(
      'documents.document',
      [['type', '!=', 'folder']],
      [...DOCUMENTS_MODULE_FIELDS],
      { limit: backofficeDocumentLimit, order: 'write_date desc' },
    ),
  ])

  const folderById = new Map(folders.map((folder) => [folder.id, folder]))
  const folderMatches = new Map<number, ReturnType<typeof matchFolderToProduct>>()
  const fileCounts = new Map<number, number>()

  for (const doc of backofficeDocuments) {
    const folderId = many2oneId(doc.folder_id)
    if (folderId) fileCounts.set(folderId, (fileCounts.get(folderId) ?? 0) + 1)
  }

  const mappedFolders: OdooDocumentFolderItem[] = folders.map((folder) => {
    const folderId = folder.id
    const path = buildFolderPath(folder, folderById)
    const match = matchFolderToProduct(String(folder.name ?? ''), products)
    folderMatches.set(folderId, match)
    const scope = classifyFolder(path, match.status)

    return {
      odooFolderId: folderId,
      name: String(folder.name ?? 'Sin nombre'),
      parentFolderId: many2oneId(folder.folder_id),
      parentFolderName: many2oneName(folder.folder_id),
      path,
      scope,
      relationStatus: match.status,
      unmatchedReason: match.reason,
      matchedProductId: match.productId,
      matchedProductName: match.productName,
      matchConfidence: match.confidence,
      fileCount: fileCounts.get(folderId) ?? 0,
    }
  })

  const mappedBackofficeDocuments: OdooBackofficeDocumentItem[] = backofficeDocuments.map((doc) => {
    const folderId = many2oneId(doc.folder_id)
    const folderName = many2oneName(doc.folder_id)
    const folder = folderId ? folderById.get(folderId) : undefined
    const folderPath = folder ? buildFolderPath(folder, folderById) : (folderName ?? 'Sin carpeta')
    const match = folderId ? folderMatches.get(folderId) : undefined
    const relationStatus = match?.status ?? 'unmatched'
    const scope = classifyFolder(`${folderPath} / ${String(doc.name ?? '')}`, relationStatus)

    return {
      source: 'documents.document',
      odooDocumentId: doc.id,
      name: String(doc.name ?? 'Sin nombre'),
      type: String(doc.type ?? ''),
      mimetype: typeof doc.mimetype === 'string' ? doc.mimetype : null,
      fileSize: typeof doc.file_size === 'number' ? doc.file_size : 0,
      folderId,
      folderName,
      folderPath,
      resModel: asStringOrFalse(doc.res_model),
      resId: typeof doc.res_id === 'number' ? doc.res_id : 0,
      resName: asStringOrFalse(doc.res_name),
      attachmentId: many2oneId(doc.attachment_id),
      scope,
      relationStatus,
      unmatchedReason: match?.reason ?? (folderId ? null : 'missing-parent'),
      matchedProductId: match?.productId ?? null,
      matchedProductName: match?.productName ?? null,
      matchConfidence: match?.confidence ?? 0,
      writeDate: typeof doc.write_date === 'string' ? doc.write_date : null,
    }
  })

  const mappedProductDocuments: OdooProductDocumentItem[] = productDocuments.map((doc) => ({
    source: 'product.document',
    odooDocumentId: doc.id,
    odooAttachmentId: many2oneId(doc.ir_attachment_id),
    name: String(doc.name ?? 'Sin nombre'),
    mimetype: typeof doc.mimetype === 'string' ? doc.mimetype : null,
    fileSize: typeof doc.file_size === 'number' ? doc.file_size : 0,
    resId: typeof doc.res_id === 'number' ? doc.res_id : 0,
    resName: String(doc.res_name ?? ''),
    shownOnProductPage: Boolean(doc.shown_on_product_page),
    attachedOnSale: typeof doc.attached_on_sale === 'string' ? doc.attached_on_sale : false,
    writeDate: typeof doc.write_date === 'string' ? doc.write_date : null,
  }))

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      productDocuments: mappedProductDocuments.length,
      folders: mappedFolders.length,
      backofficeDocuments: mappedBackofficeDocuments.length,
      linkedBackofficeDocuments: mappedBackofficeDocuments.filter((doc) => doc.relationStatus !== 'unmatched').length,
      unmatchedBackofficeDocuments: mappedBackofficeDocuments.filter((doc) => doc.relationStatus === 'unmatched').length,
    },
    productDocuments: mappedProductDocuments,
    folders: mappedFolders,
    backofficeDocuments: mappedBackofficeDocuments,
  }
}
