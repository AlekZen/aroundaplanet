'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SCOPE_LABELS, SCOPE_OPTIONS, type DocumentMirrorClient, type DocumentScope } from './types'

interface Props {
  document: DocumentMirrorClient | null
  open: boolean
  onClose: () => void
}

export function DocumentDetail({ document, open, onClose }: Props) {
  const [scope, setScope] = useState<DocumentScope | ''>('')
  const [productIdStr, setProductIdStr] = useState('')
  const [productName, setProductName] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'patch' | 'unrelate' | null>(null)

  if (!document) return null

  const initialize = () => {
    setScope(document.adminOverride?.scope ?? '')
    setProductIdStr(
      document.adminOverride?.relatedProductId
        ? String(document.adminOverride.relatedProductId)
        : '',
    )
    setProductName(document.adminOverride?.relatedProductName ?? '')
    setReason(document.adminOverride?.markedUnrelatedReason ?? '')
  }

  const handleOpenChange = (next: boolean) => {
    if (next) initialize()
    else onClose()
  }

  const handleSave = async () => {
    if (!scope && !productIdStr && !productName) {
      toast.error('Cambia al menos un campo antes de guardar')
      return
    }
    setBusy('patch')
    try {
      const body: Record<string, unknown> = {}
      if (scope) body.scopeOverride = scope
      if (productIdStr) {
        const pid = Number.parseInt(productIdStr, 10)
        if (!Number.isFinite(pid) || pid <= 0) {
          toast.error('Product ID debe ser un entero positivo')
          setBusy(null)
          return
        }
        body.relatedProductId = pid
      }
      if (productName) body.relatedProductName = productName

      const res = await fetch(`/api/odoo/documents/${document.odooDocumentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(err.message ?? 'Error al guardar')
      }
      toast.success('Override admin guardado')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setBusy(null)
    }
  }

  const handleMarkUnrelated = async () => {
    setBusy('unrelate')
    try {
      const res = await fetch(
        `/api/odoo/documents/${document.odooDocumentId}/mark-unrelated`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
        },
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(err.message ?? 'Error al marcar')
      }
      toast.success('Marcado como no-relacionado')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{document.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Odoo ID</p>
              <p className="font-medium">#{document.odooDocumentId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Carpeta</p>
              <p className="font-medium">{document.folderName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Scope efectivo</p>
              <Badge>{SCOPE_LABELS[document.effectiveScope]}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tipo / MIME</p>
              <p>{document.mimetype ?? document.type}</p>
            </div>
          </div>

          {document.attachmentId && (
            <a
              href={`/api/odoo/documents/attachments/${document.attachmentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm text-primary underline"
            >
              Abrir archivo en Odoo
            </a>
          )}

          <hr className="border-border" />

          <div className="space-y-2">
            <Label>Override scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as DocumentScope)}>
              <SelectTrigger>
                <SelectValue placeholder="Sin override" />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SCOPE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="relatedProductId">Producto Odoo (id)</Label>
              <Input
                id="relatedProductId"
                inputMode="numeric"
                value={productIdStr}
                onChange={(e) => setProductIdStr(e.target.value)}
                placeholder="1748"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relatedProductName">Nombre</Label>
              <Input
                id="relatedProductName"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="ASIA MAYO 2026"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unrelatedReason">Razón para marcar como no-relacionado</Label>
            <Textarea
              id="unrelatedReason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Documento interno sin asociación con producto."
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button
            variant="destructive"
            disabled={busy !== null}
            onClick={() => void handleMarkUnrelated()}
          >
            {busy === 'unrelate' ? 'Marcando…' : 'Marcar no-relacionado'}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy !== null}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={busy !== null}>
              {busy === 'patch' ? 'Guardando…' : 'Guardar override'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
