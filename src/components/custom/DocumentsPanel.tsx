'use client'

/**
 * Story 8.1c — Documents Backoffice orchestrator.
 *
 * Lee mirrors Firestore en realtime (onSnapshot) de tres colecciones:
 *  - `/odooDocuments` — archivos no-folder
 *  - `/odooDocumentFolders` — folders
 *  - `/odooDocumentFolderMappings` — mappings admin-confirmados
 *
 * Acciones admin van a endpoints `/api/odoo/documents/[id]` PATCH,
 * `/api/odoo/documents/[id]/mark-unrelated` y `/api/odoo/documents/folder-mappings`.
 *
 * El botón "Sincronizar" sigue golpeando `/api/odoo/documents/sync` (Story 8.1b)
 * que reactiva el pull Odoo→Firestore; onSnapshot refleja los writes.
 *
 * Tab "Públicos del producto" sigue usando `/api/odoo/documents?mode=review`
 * (no hay mirror Firestore para `product.document`, fuera de scope 8.1c).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { toast } from 'sonner'
import { FileText, RefreshCw, ShieldAlert } from 'lucide-react'
import { firebaseApp } from '@/lib/firebase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DocumentsFilters, type DocumentsFiltersValue } from './documents/DocumentsFilters'
import { DocumentsList } from './documents/DocumentsList'
import { DocumentDetail } from './documents/DocumentDetail'
import { FolderClusterView } from './documents/FolderClusterView'
import type {
  DocumentMirrorClient,
  DocumentScope,
  FolderMappingClient,
  FolderMirrorClient,
} from './documents/types'
import type {
  OdooDocumentsOverview,
  OdooProductDocumentItem,
} from '@/types/odooDocuments'

const db = getFirestore(firebaseApp)

function formatBytes(bytes: number) {
  if (!bytes) return '-'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function matchesSearch(values: Array<string | number | null | undefined>, needle: string) {
  if (!needle) return true
  const n = needle.toLowerCase()
  return values.some((v) => String(v ?? '').toLowerCase().includes(n))
}

function deriveRelationStatus(
  doc: DocumentMirrorClient & { adminOverride?: { relatedProductId?: number | null } },
): 'linked' | 'suggested' | 'unmatched' {
  if (doc.adminOverride?.markedUnrelated) return 'unmatched'
  if (doc.adminOverride?.relatedProductId) return 'linked'
  if (doc.resId && doc.resModel === 'product.template') return 'linked'
  if (doc.effectiveScope === 'unmatched') return 'unmatched'
  return 'suggested'
}

export function DocumentsPanel() {
  const [documents, setDocuments] = useState<DocumentMirrorClient[]>([])
  const [folders, setFolders] = useState<FolderMirrorClient[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [foldersLoading, setFoldersLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [filters, setFilters] = useState<DocumentsFiltersValue>({ search: '', scope: 'all' })
  const [selected, setSelected] = useState<DocumentMirrorClient | null>(null)
  const [productDocs, setProductDocs] = useState<OdooProductDocumentItem[] | null>(null)
  const [productDocsLoading, setProductDocsLoading] = useState(false)

  // --- Firestore: odooDocuments ---
  useEffect(() => {
    const ctrl = new AbortController()
    // Limit grande: la colección admin no debería pasar de 5k. orderBy writeDate desc.
    const q = query(collection(db, 'odooDocuments'), orderBy('writeDate', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (ctrl.signal.aborted) return
        const items: DocumentMirrorClient[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>
          const adminOverride = (data.adminOverride ?? undefined) as
            | DocumentMirrorClient['adminOverride']
            | undefined
          const baseScope = (data.scope as DocumentScope) ?? 'unmatched'
          const effective = adminOverride?.scope ?? baseScope
          const base: DocumentMirrorClient = {
            id: d.id,
            odooDocumentId: (data.odooDocumentId as number) ?? Number(d.id),
            name: (data.name as string) ?? 'Sin nombre',
            type: (data.type as string) ?? 'binary',
            mimetype: (data.mimetype as string | null) ?? null,
            fileSize: (data.fileSize as number) ?? 0,
            folderId: (data.folderId as number | null) ?? null,
            folderName: (data.folderName as string | null) ?? null,
            attachmentId: (data.attachmentId as number | null) ?? null,
            resModel: (data.resModel as string | null) ?? null,
            resId: (data.resId as number | null) ?? null,
            resName: (data.resName as string | null) ?? null,
            scope: baseScope,
            writeDate: (data.writeDate as string | null) ?? null,
            adminOverride,
            effectiveScope: effective,
            relationStatus: 'unmatched',
          }
          base.relationStatus = deriveRelationStatus(base)
          return base
        })
        setDocuments(items)
        setDocsLoading(false)
      },
      (err) => {
        if (ctrl.signal.aborted) return
        console.error('[DocumentsPanel] odooDocuments snapshot error', err)
        setError(err.message)
        setDocsLoading(false)
      },
    )
    return () => {
      ctrl.abort()
      unsub()
    }
  }, [])

  // --- Firestore: odooDocumentFolders + odooDocumentFolderMappings join ---
  useEffect(() => {
    const ctrl = new AbortController()
    const qFolders = query(collection(db, 'odooDocumentFolders'), orderBy('name'))
    let foldersRaw: FolderMirrorClient[] = []
    let mappings = new Map<number, FolderMappingClient>()

    const recompute = () => {
      const fileCounts = new Map<number, number>()
      for (const d of documents) {
        if (d.folderId != null) {
          fileCounts.set(d.folderId, (fileCounts.get(d.folderId) ?? 0) + 1)
        }
      }
      setFolders(
        foldersRaw.map((f) => ({
          ...f,
          fileCount: fileCounts.get(f.odooFolderId) ?? 0,
          mapping: mappings.get(f.odooFolderId),
        })),
      )
    }

    const unsubFolders = onSnapshot(
      qFolders,
      (snap) => {
        if (ctrl.signal.aborted) return
        foldersRaw = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>
          return {
            id: d.id,
            odooFolderId: (data.odooFolderId as number) ?? Number(d.id),
            name: (data.name as string) ?? 'Sin nombre',
            parentFolderId: (data.parentFolderId as number | null) ?? null,
            parentFolderName: (data.parentFolderName as string | null) ?? null,
            isCanonical: Boolean(data.isCanonical),
            isDuplicate: Boolean(data.isDuplicate),
            writeDate: (data.writeDate as string | null) ?? null,
            fileCount: 0,
          }
        })
        setFoldersLoading(false)
        recompute()
      },
      (err) => {
        if (ctrl.signal.aborted) return
        console.error('[DocumentsPanel] folders snapshot error', err)
        setFoldersLoading(false)
      },
    )

    const unsubMappings = onSnapshot(
      collection(db, 'odooDocumentFolderMappings'),
      (snap) => {
        if (ctrl.signal.aborted) return
        mappings = new Map(
          snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>
            return [
              (data.duplicateFolderId as number) ?? Number(d.id),
              {
                id: d.id,
                duplicateFolderId: (data.duplicateFolderId as number) ?? Number(d.id),
                canonicalFolderId: (data.canonicalFolderId as number) ?? Number(d.id),
                status: (data.status as FolderMappingClient['status']) ?? 'auto',
                confidence: (data.confidence as number) ?? 0,
                relatedProductId: (data.relatedProductId as number | null) ?? null,
                relatedProductName: (data.relatedProductName as string | null) ?? null,
                scopeOverride: (data.scopeOverride as DocumentScope | null) ?? null,
              },
            ] as const
          }),
        )
        recompute()
      },
      (err) => {
        if (ctrl.signal.aborted) return
        console.error('[DocumentsPanel] mappings snapshot error', err)
      },
    )

    return () => {
      ctrl.abort()
      unsubFolders()
      unsubMappings()
    }
    // documents intentionally NOT a dep: fileCount recompute happens on each snapshot
    // and we don't need to re-subscribe when documents change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recompute folder fileCounts when documents change without resubscribing.
  useEffect(() => {
    setFolders((prev) => {
      const counts = new Map<number, number>()
      for (const d of documents) {
        if (d.folderId != null) counts.set(d.folderId, (counts.get(d.folderId) ?? 0) + 1)
      }
      return prev.map((f) => ({ ...f, fileCount: counts.get(f.odooFolderId) ?? f.fileCount }))
    })
  }, [documents])

  const handleSync = useCallback(async () => {
    setIsSyncing(true)
    setError(null)
    try {
      const res = await fetch('/api/odoo/documents/sync', { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message ?? 'Error al sincronizar')
      }
      const summary = await res.json()
      toast.success(`Sync OK · ${summary.updated} actualizados`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSyncing(false)
    }
  }, [])

  const loadProductDocs = useCallback(async () => {
    if (productDocs || productDocsLoading) return
    setProductDocsLoading(true)
    try {
      const res = await fetch('/api/odoo/documents?mode=review')
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message ?? 'Error al cargar product.documents')
      }
      const overview = (await res.json()) as OdooDocumentsOverview
      setProductDocs(overview.productDocuments)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error cargando documentos de producto')
    } finally {
      setProductDocsLoading(false)
    }
  }, [productDocs, productDocsLoading])

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      if (
        filters.scope !== 'all' &&
        doc.effectiveScope !== filters.scope
      ) {
        return false
      }
      return matchesSearch(
        [
          doc.name,
          doc.folderName,
          doc.resName,
          doc.adminOverride?.relatedProductName,
          doc.odooDocumentId,
        ],
        filters.search,
      )
    })
  }, [documents, filters])

  const linked = filtered.filter((d) => d.relationStatus !== 'unmatched')
  const unmatched = filtered.filter((d) => d.relationStatus === 'unmatched')

  const filteredFolders = useMemo(
    () =>
      folders.filter((f) =>
        matchesSearch(
          [f.name, f.parentFolderName, f.mapping?.relatedProductName, f.odooFolderId],
          filters.search,
        ),
      ),
    [folders, filters.search],
  )

  const filteredProductDocs = useMemo(
    () =>
      (productDocs ?? []).filter((p) =>
        matchesSearch([p.name, p.resName, p.mimetype, p.odooDocumentId, p.resId], filters.search),
      ),
    [productDocs, filters.search],
  )

  const loading = docsLoading || foldersLoading

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <DocumentsFilters value={filters} onChange={setFilters} />
        <Button onClick={() => void handleSync()} disabled={isSyncing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sincronizando…' : 'Sincronizar metadata'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <ShieldAlert className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 animate-pulse rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-80 w-full animate-pulse" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Documentos" value={documents.length} />
            <Metric label="Relacionados" value={documents.filter((d) => d.relationStatus !== 'unmatched').length} />
            <Metric label="Sin relacionar" value={documents.filter((d) => d.relationStatus === 'unmatched').length} />
            <Metric label="Carpetas" value={folders.length} />
          </div>

          <Tabs defaultValue="linked" className="space-y-3">
            <TabsList className="flex h-auto flex-wrap justify-start">
              <TabsTrigger value="linked">Relacionados</TabsTrigger>
              <TabsTrigger value="unmatched">Sin relacionar</TabsTrigger>
              <TabsTrigger value="folders">Carpetas</TabsTrigger>
              <TabsTrigger value="public" onClick={() => void loadProductDocs()}>
                Públicos del producto
              </TabsTrigger>
            </TabsList>
            <TabsContent value="linked">
              <DocumentsList
                documents={linked}
                emptyText="Sin documentos relacionados con ese filtro."
                onSelect={setSelected}
                selectedId={selected?.id}
              />
            </TabsContent>
            <TabsContent value="unmatched">
              <DocumentsList
                documents={unmatched}
                emptyText="Sin documentos pendientes de relacionar."
                onSelect={setSelected}
                selectedId={selected?.id}
              />
            </TabsContent>
            <TabsContent value="folders">
              <FolderClusterView folders={filteredFolders} />
            </TabsContent>
            <TabsContent value="public">
              {productDocsLoading && !productDocs ? (
                <Skeleton className="h-40 w-full animate-pulse" />
              ) : (
                <ProductDocumentsTable
                  docs={filteredProductDocs}
                  formatBytes={formatBytes}
                />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <DocumentDetail
        document={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

function ProductDocumentsTable({
  docs,
  formatBytes,
}: {
  docs: OdooProductDocumentItem[]
  formatBytes: (bytes: number) => string
}) {
  if (docs.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <FileText className="h-5 w-5" />
          No hay documentos públicos de producto con ese filtro.
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Documento</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Visible web</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Tamaño</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((doc) => (
            <TableRow key={doc.odooDocumentId}>
              <TableCell>
                <p className="font-medium">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  Doc #{doc.odooDocumentId} / Adj #{doc.odooAttachmentId ?? '-'}
                </p>
              </TableCell>
              <TableCell>{doc.resName}</TableCell>
              <TableCell>
                <Badge variant={doc.shownOnProductPage ? 'default' : 'secondary'}>
                  {doc.shownOnProductPage ? 'Sí' : 'No'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{doc.mimetype ?? '-'}</TableCell>
              <TableCell className="tabular-nums">{formatBytes(doc.fileSize)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
