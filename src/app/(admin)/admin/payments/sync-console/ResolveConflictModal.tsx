'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { PaymentConflict } from '@/schemas/paymentConflictSchema'
import { CONFLICT_RESOLUTIONS } from '@/schemas/paymentConflictSchema'

const resolveFormSchema = z
  .object({
    resolution: z.enum(CONFLICT_RESOLUTIONS),
    customValue: z.string().optional(),
    resolutionNote: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.resolution !== 'custom') return true
      return data.customValue !== undefined && data.customValue.trim() !== ''
    },
    { message: 'El valor personalizado es obligatorio', path: ['customValue'] },
  )

type ResolveFormValues = z.infer<typeof resolveFormSchema>

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (field === 'amount' && typeof value === 'number') {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value / 100)
  }
  if (field === 'paymentDate') {
    if (typeof value === 'string') return value
    if (value instanceof Date) return value.toLocaleDateString('es-MX')
  }
  return String(value)
}

function formatTs(ts: unknown): string {
  if (!ts) return '—'
  if (typeof ts === 'string') return new Date(ts).toLocaleString('es-MX')
  if (ts instanceof Date) return ts.toLocaleString('es-MX')
  const obj = ts as Record<string, unknown>
  if (typeof obj.seconds === 'number') {
    return new Date(obj.seconds * 1000).toLocaleString('es-MX')
  }
  return '—'
}

interface Props {
  conflict: PaymentConflict & { conflictId: string }
  open: boolean
  onClose: () => void
}

export function ResolveConflictModal({ conflict, open, onClose }: Props) {
  const [busy, setBusy] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResolveFormValues>({
    resolver: zodResolver(resolveFormSchema),
    defaultValues: { resolution: 'firestore' },
  })

  const resolution = watch('resolution')

  const onSubmit = async (values: ResolveFormValues) => {
    setBusy(true)
    try {
      let resolutionValue: unknown = undefined
      if (values.resolution === 'custom' && values.customValue !== undefined) {
        if (conflict.field === 'amount') {
          resolutionValue = Math.round(parseFloat(values.customValue) * 100)
        } else if (conflict.field === 'paymentDate') {
          resolutionValue = values.customValue
        } else {
          resolutionValue = values.customValue
        }
      }

      const body: Record<string, unknown> = {
        resolution: values.resolution,
        resolutionNote: values.resolutionNote || undefined,
      }
      if (resolutionValue !== undefined) {
        body.resolutionValue = resolutionValue
      }

      const res = await fetch(`/api/payment-conflicts/${conflict.conflictId}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (res.status === 409) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.message ?? 'Otro admin ya resolvió este conflicto')
        onClose()
        return
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.message ?? `Error ${res.status}`)
        return
      }

      const json = await res.json().catch(() => ({}))
      if (json.pushQueued) {
        toast.success('Conflicto resuelto · push encolado')
      } else {
        toast.success('Conflicto resuelto')
      }
      onClose()
    } catch {
      toast.error('Error de red al resolver')
    } finally {
      setBusy(false)
    }
  }

  const fieldLabel: Record<string, string> = {
    amount: 'Monto',
    memo: 'Memo',
    paymentDate: 'Fecha de pago',
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resolver conflicto — {fieldLabel[conflict.field] ?? conflict.field}</DialogTitle>
        </DialogHeader>

        {/* Comparación lado a lado */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-xs uppercase text-muted-foreground font-medium">Valor Firestore</p>
            <p className="font-semibold text-base">{formatFieldValue(conflict.field, conflict.firestoreValue)}</p>
            <p className="text-xs text-muted-foreground">Escrito: {formatTs(conflict.firestoreWrittenAt)}</p>
            {conflict.firestoreSource && (
              <Badge variant="outline" className="text-xs">{conflict.firestoreSource}</Badge>
            )}
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-xs uppercase text-muted-foreground font-medium">Valor Odoo</p>
            <p className="font-semibold text-base">{formatFieldValue(conflict.field, conflict.odooValue)}</p>
            <p className="text-xs text-muted-foreground">Escrito: {formatTs(conflict.odooWrittenAt)}</p>
            {conflict.odooSource && (
              <Badge variant="outline" className="text-xs">{conflict.odooSource}</Badge>
            )}
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Radio de resolución */}
          <div className="space-y-2">
            <Label>Resolución</Label>
            <div className="flex flex-col gap-2">
              {(
                [
                  { value: 'firestore', label: 'Conservar Firestore' },
                  { value: 'odoo', label: 'Conservar Odoo' },
                  { value: 'custom', label: 'Valor personalizado' },
                ] as const
              ).map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={opt.value}
                    {...register('resolution')}
                    className="accent-primary"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
            {errors.resolution && (
              <p className="text-xs text-destructive">{errors.resolution.message}</p>
            )}
          </div>

          {/* Input de valor personalizado (condicional) */}
          {resolution === 'custom' && (
            <div className="space-y-1">
              <Label htmlFor="customValue">
                {conflict.field === 'amount' ? 'Monto (MXN)' : conflict.field === 'memo' ? 'Memo' : 'Fecha (YYYY-MM-DD)'}
              </Label>
              {conflict.field === 'memo' ? (
                <Textarea
                  id="customValue"
                  maxLength={500}
                  {...register('customValue')}
                  placeholder="Texto del memo…"
                  rows={3}
                />
              ) : (
                <Input
                  id="customValue"
                  type={conflict.field === 'paymentDate' ? 'date' : 'number'}
                  step={conflict.field === 'amount' ? '0.01' : undefined}
                  min={conflict.field === 'amount' ? '0' : undefined}
                  max={conflict.field === 'amount' ? '9999999' : undefined}
                  {...register('customValue')}
                  placeholder={conflict.field === 'amount' ? 'Ej: 5000.00 = $5,000 MXN' : ''}
                />
              )}
              {errors.customValue && (
                <p className="text-xs text-destructive">{errors.customValue.message}</p>
              )}
            </div>
          )}

          {/* Nota de resolución */}
          <div className="space-y-1">
            <Label htmlFor="resolutionNote">Nota (opcional)</Label>
            <Textarea
              id="resolutionNote"
              maxLength={500}
              {...register('resolutionNote')}
              placeholder="Motivo de la decisión para auditoría…"
              rows={2}
            />
            {errors.resolutionNote && (
              <p className="text-xs text-destructive">{errors.resolutionNote.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Confirmar resolución'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
