/**
 * Story 8.1c — UI types compartidos para Documents Backoffice.
 *
 * Reflejan los mirrors Firestore (`odooDocuments`, `odooDocumentFolders`,
 * `odooDocumentFolderMappings`) en shapes consumibles por componentes cliente.
 */

import type { OdooDocumentAdminOverride } from '@/schemas/odooDocumentMirrorSchema'

export type DocumentScope =
  | 'public-product'
  | 'trip-backoffice'
  | 'quote'
  | 'payment'
  | 'contract'
  | 'coupon'
  | 'sales'
  | 'internal'
  | 'unmatched'

export interface DocumentMirrorClient {
  /** Firestore doc id == odooDocumentId.toString() */
  id: string
  odooDocumentId: number
  name: string
  type: string
  mimetype: string | null
  fileSize: number
  folderId: number | null
  folderName: string | null
  attachmentId: number | null
  resModel: string | null
  resId: number | null
  resName: string | null
  scope: DocumentScope
  writeDate: string | null
  adminOverride?: OdooDocumentAdminOverride
  /** Scope efectivo: adminOverride.scope ?? scope */
  effectiveScope: DocumentScope
  /** Estado de relación derivado */
  relationStatus: 'linked' | 'suggested' | 'unmatched'
}

export interface FolderMirrorClient {
  id: string
  odooFolderId: number
  name: string
  parentFolderId: number | null
  parentFolderName: string | null
  isCanonical: boolean
  isDuplicate: boolean
  writeDate: string | null
  /** Conteos derivados client-side. */
  fileCount: number
  /** Mapping persistido si existe. */
  mapping?: FolderMappingClient
}

export interface FolderMappingClient {
  id: string
  duplicateFolderId: number
  canonicalFolderId: number
  status: 'auto' | 'confirmed' | 'dismissed'
  confidence: number
  relatedProductId: number | null
  relatedProductName: string | null
  scopeOverride: DocumentScope | null
}

export const SCOPE_LABELS: Record<DocumentScope, string> = {
  'public-product': 'Público producto',
  'trip-backoffice': 'Backoffice viaje',
  quote: 'Cotización',
  payment: 'Pago',
  contract: 'Contrato',
  coupon: 'Cupón',
  sales: 'Venta',
  internal: 'Interno',
  unmatched: 'Sin relacionar',
}

export const SCOPE_OPTIONS: DocumentScope[] = [
  'public-product',
  'trip-backoffice',
  'quote',
  'payment',
  'contract',
  'coupon',
  'sales',
  'internal',
  'unmatched',
]
