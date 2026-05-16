'use client'

import { FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SCOPE_LABELS, type DocumentMirrorClient } from './types'

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

function RelationBadge({ status }: { status: 'linked' | 'suggested' | 'unmatched' }) {
  if (status === 'linked') return <Badge>Relacionado</Badge>
  if (status === 'suggested') return <Badge variant="secondary">Sugerido</Badge>
  return <Badge variant="outline">Sin relacionar</Badge>
}

function ScopeBadge({ scope }: { scope: string }) {
  const variant =
    scope === 'unmatched' ? 'destructive' : scope === 'public-product' ? 'default' : 'secondary'
  return <Badge variant={variant}>{SCOPE_LABELS[scope as keyof typeof SCOPE_LABELS] ?? scope}</Badge>
}

interface Props {
  documents: DocumentMirrorClient[]
  emptyText: string
  onSelect: (doc: DocumentMirrorClient) => void
  selectedId?: string
}

export function DocumentsList({ documents, emptyText, onSelect, selectedId }: Props) {
  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <FileText className="h-5 w-5" />
          {emptyText}
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
            <TableHead>Carpeta</TableHead>
            <TableHead>Relación</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Tamaño</TableHead>
            <TableHead>Actualizado</TableHead>
            <TableHead className="sr-only">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow
              key={doc.id}
              data-selected={selectedId === doc.id ? 'true' : undefined}
              data-testid="document-row"
              className={selectedId === doc.id ? 'bg-muted/50' : undefined}
            >
              <TableCell>
                <div className="space-y-1">
                  <p className="font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">Odoo #{doc.odooDocumentId}</p>
                </div>
              </TableCell>
              <TableCell className="max-w-xs text-sm text-muted-foreground">
                {doc.folderName ?? '—'}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <RelationBadge status={doc.relationStatus} />
                  {doc.adminOverride?.relatedProductName && (
                    <p className="text-xs text-muted-foreground">
                      {doc.adminOverride.relatedProductName}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <ScopeBadge scope={doc.effectiveScope} />
                {doc.adminOverride?.scope && (
                  <p className="mt-1 text-xs text-amber-700">Override admin</p>
                )}
              </TableCell>
              <TableCell className="tabular-nums">{formatBytes(doc.fileSize)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(doc.writeDate)}
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => onSelect(doc)}>
                  Detalle
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
