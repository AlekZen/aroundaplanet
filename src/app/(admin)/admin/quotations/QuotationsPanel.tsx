'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  QUOTATION_STATUSES,
  type QuotationStatus,
  type QuotationLeadSnapshot,
} from '@/schemas/quotationSchema'

interface Quotation {
  quotationId: string
  source: string
  status: QuotationStatus
  leadSnapshot: QuotationLeadSnapshot | null
  pdfUrl: string | null
  pdfVersion: number
  whatsappSent: boolean
  createdAt: string | null
  pdfGeneratedAt: string | null
}

const STATUS_LABEL: Record<QuotationStatus, string> = {
  lead: 'Lead',
  'pdf-generated': 'PDF generado',
  sent: 'Enviada',
  closed: 'Cerrada',
}

const STATUS_FILTER_OPTIONS = ['all', ...QUOTATION_STATUSES] as const
type StatusFilter = (typeof STATUS_FILTER_OPTIONS)[number]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function QuotationsPanel() {
  const [items, setItems] = useState<Quotation[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (filter !== 'all') qs.set('status', filter)
      const r = await fetch(`/api/quotations/list?${qs.toString()}`)
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data?.message ?? `HTTP ${r.status}`)
      }
      const data = (await r.json()) as { quotations: Quotation[] }
      setItems(data.quotations)
    } catch (e) {
      setError((e as Error).message)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  async function handleGenerate(quotationId: string) {
    setGeneratingId(quotationId)
    setError(null)
    try {
      const r = await fetch(`/api/quotations/${quotationId}/generate`, { method: 'POST' })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.message ?? `HTTP ${r.status}`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGeneratingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted-foreground">Filtro:</label>
        <Select value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {QUOTATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Recargar
        </Button>
      </div>

      {error ? (
        <div className="rounded border-l-4 border-red-500 bg-red-50 p-3 text-sm">❌ {error}</div>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !items || items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay cotizaciones que coincidan.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Destino</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Presupuesto</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Recibida</th>
                <th className="px-3 py-2 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => {
                const lead = q.leadSnapshot
                return (
                  <tr key={q.quotationId} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{lead?.nombreCliente ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{lead?.contactPhone ?? ''}</div>
                    </td>
                    <td className="px-3 py-2">{lead?.destino ?? '—'}</td>
                    <td className="px-3 py-2">{lead?.tipoViaje ?? '—'}</td>
                    <td className="px-3 py-2">{lead?.presupuesto ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{STATUS_LABEL[q.status]}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">{formatDate(q.createdAt)}</td>
                    <td className="px-3 py-2 space-y-1">
                      <Button
                        size="sm"
                        onClick={() => void handleGenerate(q.quotationId)}
                        disabled={generatingId === q.quotationId}
                      >
                        {generatingId === q.quotationId
                          ? 'Generando…'
                          : q.pdfUrl
                            ? `Regenerar (v${q.pdfVersion + 1})`
                            : 'Generar PDF'}
                      </Button>
                      {q.pdfUrl ? (
                        <a
                          href={q.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-primary underline"
                        >
                          Abrir PDF v{q.pdfVersion}
                        </a>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
