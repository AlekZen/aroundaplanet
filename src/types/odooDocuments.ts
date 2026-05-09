export type OdooDocumentSource = 'product.document' | 'documents.document'

export type OdooDocumentScope =
  | 'public-product'
  | 'trip-backoffice'
  | 'quote'
  | 'payment'
  | 'contract'
  | 'coupon'
  | 'sales'
  | 'internal'
  | 'unmatched'

export type OdooDocumentRelationStatus = 'linked' | 'suggested' | 'unmatched'

export interface OdooProductDocumentItem {
  source: 'product.document'
  odooDocumentId: number
  odooAttachmentId: number | null
  name: string
  mimetype: string | null
  fileSize: number
  resId: number
  resName: string
  shownOnProductPage: boolean
  attachedOnSale: string | false
  writeDate: string | null
}

export interface OdooBackofficeDocumentItem {
  source: 'documents.document'
  odooDocumentId: number
  name: string
  type: string
  mimetype: string | null
  fileSize: number
  folderId: number | null
  folderName: string | null
  folderPath: string
  resModel: string | false
  resId: number
  resName: string | false
  attachmentId: number | null
  scope: OdooDocumentScope
  relationStatus: OdooDocumentRelationStatus
  unmatchedReason: string | null
  matchedProductId: number | null
  matchedProductName: string | null
  matchConfidence: number
  writeDate: string | null
}

export interface OdooDocumentFolderItem {
  odooFolderId: number
  name: string
  parentFolderId: number | null
  parentFolderName: string | null
  path: string
  scope: OdooDocumentScope
  relationStatus: OdooDocumentRelationStatus
  unmatchedReason: string | null
  matchedProductId: number | null
  matchedProductName: string | null
  matchConfidence: number
  fileCount: number
}

export interface OdooDocumentsOverview {
  generatedAt: string
  counts: {
    productDocuments: number
    folders: number
    backofficeDocuments: number
    linkedBackofficeDocuments: number
    unmatchedBackofficeDocuments: number
  }
  productDocuments: OdooProductDocumentItem[]
  folders: OdooDocumentFolderItem[]
  backofficeDocuments: OdooBackofficeDocumentItem[]
}
