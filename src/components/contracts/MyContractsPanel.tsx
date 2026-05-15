'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface ContractRow {
  contractId: string
  orderId: string
  templateKey: string
  clientName: string | null
  destinoLabel: string | null
  viajeTemporada: string | null
  montoTotalFormatted: string | null
  agenteName: string | null
  version: number
  sharedWithClient: boolean
  sharedWithAgent: boolean
  acceptedAt: string | null
  viewerRole: 'client' | 'agent' | 'other'
  createdAt: string | null
}

interface Props {
  viewerHint: 'client' | 'agent'
}

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

export function MyContractsPanel({ viewerHint }: Props) {
  const [rows, setRows] = useState<ContractRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/contracts/list-mine')
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e?.message ?? `HTTP ${r.status}`)
      }
      const data = (await r.json()) as { contracts: ContractRow[] }
      setRows(data.contracts)
    } catch (e) {
      setError((e as Error).message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function openPdf(contractId: string) {
    setPendingId(contractId)
    setError(null)
    try {
      const r = await fetch(`/api/contracts/${contractId}/url`)
      const data = await r.json()
      if (!r.ok) throw new Error(data?.message ?? `HTTP ${r.status}`)
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  async function acceptContract(contractId: string) {
    if (!confirm('¿Confirmas que has leído y aceptas los términos de este contrato?')) return
    setPendingId(contractId)
    setError(null)
    try {
      const r = await fetch(`/api/contracts/${contractId}/accept`, { method: 'POST' })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.message ?? `HTTP ${r.status}`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded border-l-4 border-red-500 bg-red-50 p-3 text-sm">❌ {error}</div>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded border-l-4 border-blue-500 bg-blue-50 p-4 text-sm">
        {viewerHint === 'client'
          ? 'Tu agente aún no te ha compartido contratos. Cuando estén listos para revisar, aparecerán aquí.'
          : 'Aún no hay contratos compartidos contigo como agente. Cuando admin active la visibilidad, aparecerán aquí.'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {rows.map((c) => (
        <article
          key={c.contractId}
          className="rounded-lg border border-border bg-card p-4 space-y-3"
        >
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-heading text-lg font-semibold text-foreground">
                {c.destinoLabel ?? c.templateKey}
              </h3>
              <p className="text-sm text-muted-foreground">
                {c.viajeTemporada ?? ''} · v{c.version}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {c.acceptedAt ? (
                <Badge className="bg-green-600 text-white">Aceptado</Badge>
              ) : (
                <Badge variant="outline">Pendiente de aceptar</Badge>
              )}
              {c.viewerRole === 'agent' && <Badge variant="outline">Visible como agente</Badge>}
            </div>
          </header>

          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Cliente</dt>
            <dd>{c.clientName ?? '—'}</dd>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-medium">{c.montoTotalFormatted ?? '—'}</dd>
            <dt className="text-muted-foreground">Agente</dt>
            <dd>{c.agenteName ?? '—'}</dd>
            <dt className="text-muted-foreground">Recibido</dt>
            <dd>{formatDate(c.createdAt)}</dd>
            {c.acceptedAt && (
              <>
                <dt className="text-muted-foreground">Aceptado</dt>
                <dd>{formatDate(c.acceptedAt)}</dd>
              </>
            )}
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pendingId === c.contractId}
              onClick={() => void openPdf(c.contractId)}
            >
              {pendingId === c.contractId ? 'Cargando…' : 'Ver / descargar PDF'}
            </Button>
            {viewerHint === 'client' && !c.acceptedAt && (
              <Button
                size="sm"
                disabled={pendingId === c.contractId}
                onClick={() => void acceptContract(c.contractId)}
              >
                {pendingId === c.contractId ? 'Procesando…' : 'Aceptar términos'}
              </Button>
            )}
          </div>

          {viewerHint === 'client' && !c.acceptedAt && (
            <p className="text-xs text-muted-foreground">
              Al aceptar registramos la fecha, tu cuenta y tu dirección IP como evidencia de
              aceptación. Esto NO sustituye una firma electrónica formal ante SAT.
            </p>
          )}
        </article>
      ))}
    </div>
  )
}
