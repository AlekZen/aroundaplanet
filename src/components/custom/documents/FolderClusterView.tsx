'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Folder } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { FolderMirrorClient } from './types'

interface Props {
  folders: FolderMirrorClient[]
}

interface ActionState {
  folderId: number
  folderName: string
  productId: string
  productName: string
  busy: 'confirm' | 'ignore' | 'unrelate' | null
}

export function FolderClusterView({ folders }: Props) {
  const [active, setActive] = useState<ActionState | null>(null)

  if (folders.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Folder className="h-5 w-5" />
          No hay carpetas con ese filtro.
        </CardContent>
      </Card>
    )
  }

  const open = (folder: FolderMirrorClient) => {
    setActive({
      folderId: folder.odooFolderId,
      folderName: folder.name,
      productId: folder.mapping?.relatedProductId
        ? String(folder.mapping.relatedProductId)
        : '',
      productName: folder.mapping?.relatedProductName ?? '',
      busy: null,
    })
  }

  const runAction = async (action: 'confirm' | 'ignore' | 'unrelate') => {
    if (!active) return
    setActive({ ...active, busy: action })
    try {
      const body: Record<string, unknown> = { folderId: active.folderId, action }
      if (action === 'confirm') {
        if (active.productId) {
          const pid = Number.parseInt(active.productId, 10)
          if (!Number.isFinite(pid) || pid <= 0) {
            toast.error('Product ID inválido')
            setActive({ ...active, busy: null })
            return
          }
          body.productId = pid
        }
        if (active.productName) body.productName = active.productName
      }
      const res = await fetch('/api/odoo/documents/folder-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(err.message ?? 'Error en mapping')
      }
      const labels = {
        confirm: 'Mapping confirmado',
        ignore: 'Mapping ignorado',
        unrelate: 'Mapping eliminado',
      } as const
      toast.success(labels[action])
      setActive(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido')
      setActive((prev) => (prev ? { ...prev, busy: null } : prev))
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Carpeta</TableHead>
              <TableHead>Padre</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Mapping</TableHead>
              <TableHead>Archivos</TableHead>
              <TableHead className="sr-only">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {folders.map((folder) => (
              <TableRow key={folder.id} data-testid="folder-row">
                <TableCell>
                  <p className="font-medium">{folder.name}</p>
                  <p className="text-xs text-muted-foreground">Odoo #{folder.odooFolderId}</p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {folder.parentFolderName ?? '—'}
                </TableCell>
                <TableCell>
                  {folder.isCanonical && <Badge>Canónico</Badge>}
                  {folder.isDuplicate && (
                    <Badge variant="secondary" className="ml-1">
                      Duplicado
                    </Badge>
                  )}
                  {!folder.isCanonical && !folder.isDuplicate && (
                    <Badge variant="outline">Sin tag</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {folder.mapping ? (
                    <div className="space-y-1 text-xs">
                      <Badge
                        variant={
                          folder.mapping.status === 'confirmed'
                            ? 'default'
                            : folder.mapping.status === 'dismissed'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {folder.mapping.status}
                      </Badge>
                      {folder.mapping.relatedProductName && (
                        <p className="text-muted-foreground">
                          {folder.mapping.relatedProductName}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{folder.fileCount}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => open(folder)}>
                    Acciones
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {active && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="font-medium">
              Acciones para {active.folderName}{' '}
              <span className="text-xs text-muted-foreground">#{active.folderId}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                value={active.productId}
                onChange={(e) => setActive({ ...active, productId: e.target.value })}
                placeholder="Product ID (opcional)"
              />
              <Input
                value={active.productName}
                onChange={(e) => setActive({ ...active, productName: e.target.value })}
                placeholder="Nombre producto (opcional)"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void runAction('confirm')}
                disabled={active.busy !== null}
              >
                {active.busy === 'confirm' ? 'Confirmando…' : 'Confirmar mapping'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void runAction('ignore')}
                disabled={active.busy !== null}
              >
                {active.busy === 'ignore' ? 'Ignorando…' : 'Ignorar'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void runAction('unrelate')}
                disabled={active.busy !== null}
              >
                {active.busy === 'unrelate' ? 'Eliminando…' : 'Eliminar mapping'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActive(null)}
                disabled={active.busy !== null}
              >
                Cerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
