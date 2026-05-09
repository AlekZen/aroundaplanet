'use client'

import { useCallback, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { FileText, Folder, RefreshCw, Search, ShieldAlert } from 'lucide-react'
import type {
  OdooBackofficeDocumentItem,
  OdooDocumentFolderItem,
  OdooDocumentsOverview,
  OdooProductDocumentItem,
} from '@/types/odooDocuments'

const SCOPE_LABELS: Record<string, string> = {
  'public-product': 'Publico producto',
  'trip-backoffice': 'Backoffice viaje',
  quote: 'Cotizacion',
  payment: 'Pago',
  contract: 'Contrato',
  coupon: 'Cupon',
  sales: 'Venta',
  internal: 'Interno',
  unmatched: 'Sin relacionar',
}

function formatBytes(bytes: number) {
  if (!bytes) return '-'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  return new Date(normalized).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function includesSearch(values: unknown[], search: string) {
  if (!search) return true
  const needle = search.toLowerCase()
  return values.some((value) => String(value ?? '').toLowerCase().includes(needle))
}

function ScopeBadge({ scope }: { scope: string }) {
  const variant = scope === 'unmatched' ? 'destructive' : scope === 'public-product' ? 'default' : 'secondary'
  return <Badge variant={variant}>{SCOPE_LABELS[scope] ?? scope}</Badge>
}

function RelationBadge({ status }: { status: string }) {
  if (status === 'linked') return <Badge>Relacionado</Badge>
  if (status === 'suggested') return <Badge variant="secondary">Sugerido</Badge>
  return <Badge variant="outline">Sin relacionar</Badge>
}

export function DocumentsPanel() {
  const [data, setData] = useState<OdooDocumentsOverview | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 30000)
      const res = await fetch('/api/odoo/documents?mode=review', { signal: controller.signal })
      window.clearTimeout(timeout)
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.message ?? 'Error al cargar documentos')
      }
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error && err.name === 'AbortError' ? 'Odoo tardo mas de 30s en responder. Intenta sincronizar otra vez.' : err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleSync = async () => {
    setIsSyncing(true)
    setError(null)
    try {
      const res = await fetch('/api/odoo/documents/sync', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.message ?? 'Error al sincronizar documentos')
      }
      await fetchDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsSyncing(false)
    }
  }

  const linkedDocs = useMemo(
    () => (data?.backofficeDocuments ?? []).filter((doc) =>
      doc.relationStatus !== 'unmatched' &&
      includesSearch([doc.name, doc.folderPath, doc.matchedProductName, doc.scope, doc.odooDocumentId], search),
    ),
    [data, search],
  )

  const unmatchedDocs = useMemo(
    () => (data?.backofficeDocuments ?? []).filter((doc) =>
      doc.relationStatus === 'unmatched' &&
      includesSearch([doc.name, doc.folderPath, doc.unmatchedReason, doc.scope, doc.odooDocumentId], search),
    ),
    [data, search],
  )

  const folders = useMemo(
    () => (data?.folders ?? []).filter((folder) =>
      includesSearch([folder.name, folder.path, folder.matchedProductName, folder.unmatchedReason, folder.scope, folder.odooFolderId], search),
    ),
    [data, search],
  )

  const productDocs = useMemo(
    () => (data?.productDocuments ?? []).filter((doc) =>
      includesSearch([doc.name, doc.resName, doc.mimetype, doc.odooDocumentId, doc.resId], search),
    ),
    [data, search],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar documento, carpeta, producto o ID"
            className="pl-9"
          />
        </div>
        <Button onClick={handleSync} disabled={isSyncing || isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing || isLoading ? 'animate-spin' : ''}`} />
          {data ? 'Sincronizar metadata' : 'Cargar metadata'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <ShieldAlert className="h-4 w-4" />
          {error}
        </div>
      )}

      {isLoading && !data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-lg" />)}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      )}

      {!isLoading && !data && !error && (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Metadata lista para consultar</p>
              <p className="text-sm text-muted-foreground">
                Presiona cargar metadata para traer carpetas y documentos desde Odoo en modo revision.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Metric label="Publicos producto" value={data.counts.productDocuments} />
            <Metric label="Carpetas" value={data.counts.folders} />
            <Metric label="Backoffice" value={data.counts.backofficeDocuments} />
            <Metric label="Relacionados" value={data.counts.linkedBackofficeDocuments} />
            <Metric label="Sin relacionar" value={data.counts.unmatchedBackofficeDocuments} />
          </div>

          <Tabs defaultValue="linked" className="space-y-3">
            <TabsList className="flex h-auto flex-wrap justify-start">
              <TabsTrigger value="linked">Relacionados</TabsTrigger>
              <TabsTrigger value="unmatched">Sin relacionar</TabsTrigger>
              <TabsTrigger value="folders">Carpetas</TabsTrigger>
              <TabsTrigger value="public">Publicos del producto</TabsTrigger>
            </TabsList>
            <TabsContent value="linked">
              <BackofficeTable documents={linkedDocs} empty="No hay documentos relacionados con ese filtro." />
            </TabsContent>
            <TabsContent value="unmatched">
              <BackofficeTable documents={unmatchedDocs} empty="No hay documentos sin relacionar con ese filtro." showReason />
            </TabsContent>
            <TabsContent value="folders">
              <FoldersTable folders={folders} />
            </TabsContent>
            <TabsContent value="public">
              <ProductDocumentsTable documents={productDocs} />
            </TabsContent>
          </Tabs>
          <p className="text-xs text-muted-foreground">Metadata generada: {formatDate(data.generatedAt)}</p>
        </>
      )}
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

function BackofficeTable({ documents, empty, showReason = false }: { documents: OdooBackofficeDocumentItem[]; empty: string; showReason?: boolean }) {
  if (documents.length === 0) {
    return <EmptyState icon={<FileText className="h-5 w-5" />} text={empty} />
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Documento</TableHead>
            <TableHead>Carpeta</TableHead>
            <TableHead>Relacion</TableHead>
            <TableHead>Scope</TableHead>
            {showReason && <TableHead>Razon</TableHead>}
            <TableHead>Tipo</TableHead>
            <TableHead>Tamano</TableHead>
            <TableHead>Actualizado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.odooDocumentId}>
              <TableCell>
                <div className="space-y-1">
                  <p className="font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">Odoo #{doc.odooDocumentId}</p>
                </div>
              </TableCell>
              <TableCell className="max-w-xs text-sm text-muted-foreground">{doc.folderPath}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  <RelationBadge status={doc.relationStatus} />
                  {doc.matchedProductName && <p className="text-xs text-muted-foreground">{doc.matchedProductName}</p>}
                </div>
              </TableCell>
              <TableCell><ScopeBadge scope={doc.scope} /></TableCell>
              {showReason && <TableCell className="text-sm text-muted-foreground">{doc.unmatchedReason ?? '-'}</TableCell>}
              <TableCell className="text-sm">{doc.mimetype ?? doc.type}</TableCell>
              <TableCell className="tabular-nums">{formatBytes(doc.fileSize)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(doc.writeDate)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function FoldersTable({ folders }: { folders: OdooDocumentFolderItem[] }) {
  if (folders.length === 0) {
    return <EmptyState icon={<Folder className="h-5 w-5" />} text="No hay carpetas con ese filtro." />
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Carpeta</TableHead>
            <TableHead>Relacion</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Archivos</TableHead>
            <TableHead>Confianza</TableHead>
            <TableHead>Razon</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.map((folder) => (
            <TableRow key={folder.odooFolderId}>
              <TableCell>
                <p className="font-medium">{folder.name}</p>
                <p className="text-xs text-muted-foreground">{folder.path}</p>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <RelationBadge status={folder.relationStatus} />
                  {folder.matchedProductName && <p className="text-xs text-muted-foreground">{folder.matchedProductName}</p>}
                </div>
              </TableCell>
              <TableCell><ScopeBadge scope={folder.scope} /></TableCell>
              <TableCell className="tabular-nums">{folder.fileCount}</TableCell>
              <TableCell className="tabular-nums">{folder.matchConfidence}%</TableCell>
              <TableCell className="text-sm text-muted-foreground">{folder.unmatchedReason ?? '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ProductDocumentsTable({ documents }: { documents: OdooProductDocumentItem[] }) {
  if (documents.length === 0) {
    return <EmptyState icon={<FileText className="h-5 w-5" />} text="No hay documentos publicos de producto con ese filtro." />
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Documento</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Visible web</TableHead>
            <TableHead>Venta</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Tamano</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.odooDocumentId}>
              <TableCell>
                <p className="font-medium">{doc.name}</p>
                <p className="text-xs text-muted-foreground">Doc #{doc.odooDocumentId} / Adj #{doc.odooAttachmentId ?? '-'}</p>
              </TableCell>
              <TableCell>
                <p>{doc.resName}</p>
                <p className="text-xs text-muted-foreground">product.template #{doc.resId}</p>
              </TableCell>
              <TableCell><Badge variant={doc.shownOnProductPage ? 'default' : 'secondary'}>{doc.shownOnProductPage ? 'Si' : 'No'}</Badge></TableCell>
              <TableCell className="text-sm">{doc.attachedOnSale || '-'}</TableCell>
              <TableCell className="text-sm">{doc.mimetype ?? '-'}</TableCell>
              <TableCell className="tabular-nums">{formatBytes(doc.fileSize)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        {icon}
        {text}
      </CardContent>
    </Card>
  )
}
