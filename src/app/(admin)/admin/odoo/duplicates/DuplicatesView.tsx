'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, EyeOff, Flag, Info, X } from 'lucide-react'
import type { DuplicatesGetResponse, DuplicateClusterDto, OdooPaymentRowDto } from '@/schemas/dedupSchema'

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

type ModalState =
  | { kind: 'set-canonical'; cluster: DuplicateClusterDto; canonicalId: number }
  | { kind: 'detail'; cluster: DuplicateClusterDto }
  | { kind: 'flag'; cluster: DuplicateClusterDto }
  | null

export function DuplicatesView() {
  const [data, setData] = useState<DuplicatesGetResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [includeDismissed, setIncludeDismissed] = useState(false)
  const [modal, setModal] = useState<ModalState>(null)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [flagNote, setFlagNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = includeDismissed ? '?includeDismissed=true' : ''
      const res = await fetch(`/api/admin/odoo/payments/duplicates${qs}`)
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.message ?? 'Error cargando duplicados')
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Error de red al cargar duplicados')
    } finally {
      setLoading(false)
    }
  }, [includeDismissed])

  useEffect(() => { void load() }, [load])

  const doSetCanonical = useCallback(async () => {
    if (modal?.kind !== 'set-canonical') return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/odoo/payments/duplicates/set-canonical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusterId: modal.cluster.clusterId,
          canonicalOdooId: modal.canonicalId,
          memberOdooIds: modal.cluster.members.map((m) => m.id),
        }),
      })
      const json = await res.json()
      if (res.status === 200) toast.success(`Canónico #${modal.canonicalId} marcado en Odoo`)
      else if (res.status === 207) toast.warning(`Parcial: revisar log ${json.logId}`)
      else toast.error(json.message ?? `Error ${res.status}: ${json.code}`)
      setModal(null)
      setConfirmChecked(false)
      await load()
    } finally {
      setBusy(false)
    }
  }, [modal, load])

  const doDismiss = useCallback(async (cluster: DuplicateClusterDto) => {
    if (!confirm(`¿Marcar cluster ${cluster.clusterId} como "no es duplicado real"? Desaparece de la lista por default (toggle "Mostrar dismissed" para revertir).`)) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/odoo/payments/duplicates/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusterId: cluster.clusterId,
          memberOdooIds: cluster.members.map((m) => m.id),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.message ?? `Error ${res.status}`)
        return
      }
      toast.success('Cluster descartado')
      await load()
    } finally {
      setBusy(false)
    }
  }, [load])

  const doUndismiss = useCallback(async (cluster: DuplicateClusterDto) => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/odoo/payments/duplicates/dismiss', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusterId: cluster.clusterId }),
      })
      if (!res.ok) {
        toast.error('Error al revertir')
        return
      }
      toast.success('Dismiss revertido')
      await load()
    } finally {
      setBusy(false)
    }
  }, [load])

  const doFlag = useCallback(async () => {
    if (modal?.kind !== 'flag') return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/odoo/payments/duplicates/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusterId: modal.cluster.clusterId,
          memberOdooIds: modal.cluster.members.map((m) => m.id),
          note: flagNote || undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        toast.error(j.message ?? `Error ${res.status}`)
        return
      }
      toast.success('Cluster marcado para revisar')
      setModal(null)
      setFlagNote('')
      await load()
    } finally {
      setBusy(false)
    }
  }, [modal, flagNote, load])

  const doUnflag = useCallback(async (cluster: DuplicateClusterDto) => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/odoo/payments/duplicates/flag', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusterId: cluster.clusterId }),
      })
      if (!res.ok) {
        toast.error('Error al quitar flag')
        return
      }
      toast.success('Flag removida')
      await load()
    } finally {
      setBusy(false)
    }
  }, [load])

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex flex-wrap gap-4">
            <Counter label="Total" value={data.summary.totalClusters} variant="gray" />
            <Counter label="Sin marcar" value={data.summary.unmarked} variant="yellow" />
            <Counter label="Canónico definido" value={data.summary.canonicalSet} variant="green" />
            <Counter label="Inconsistentes" value={data.summary.inconsistent} variant="red" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeDismissed}
              onChange={(e) => setIncludeDismissed(e.target.checked)}
              className="h-4 w-4"
            />
            Mostrar dismissed
          </label>
        </CardContent>
      </Card>

      {data.clusters.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay clusters de duplicados detectados.</p>
      )}

      <div className="space-y-3">
        {data.clusters.map((c) => (
          <ClusterCard
            key={c.clusterId}
            cluster={c}
            onMarkCanonical={(canonicalId) => {
              setModal({ kind: 'set-canonical', cluster: c, canonicalId })
              setConfirmChecked(false)
            }}
            onDetail={() => setModal({ kind: 'detail', cluster: c })}
            onDismiss={() => doDismiss(c)}
            onUndismiss={() => doUndismiss(c)}
            onFlag={() => { setModal({ kind: 'flag', cluster: c }); setFlagNote(c.flagNote ?? '') }}
            onUnflag={() => doUnflag(c)}
            busy={busy}
          />
        ))}
      </div>

      {/* === Modal set-canonical (irreversible) === */}
      <Dialog open={modal?.kind === 'set-canonical'} onOpenChange={(open) => { if (!open) { setModal(null); setConfirmChecked(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar canónico — Acción irreversible</DialogTitle>
            <DialogDescription>
              Escribe en Odoo (campos <code>x_dup_status</code> y <code>x_canonical_payment_id</code>).
              No se borra ni cancela nada. Una vez marcado, NO se revierte desde esta UI.
            </DialogDescription>
          </DialogHeader>
          {modal?.kind === 'set-canonical' && (
            <div className="space-y-3">
              <div className="rounded border p-3 bg-green-50">
                <p className="text-sm font-medium text-green-900">Canónico: #{modal.canonicalId}</p>
              </div>
              <div className="rounded border p-3 bg-orange-50">
                <p className="text-sm font-medium text-orange-900">Secundarios:</p>
                <ul className="ml-4 list-disc text-sm text-orange-900">
                  {modal.cluster.members.filter((m) => m.id !== modal.canonicalId).map((m) => (
                    <li key={m.id}>#{m.id} · {m.name ?? 'sin nombre'} · {formatMoney(m.amount)} · {m.date}</li>
                  ))}
                </ul>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} className="h-4 w-4" />
                Entiendo que esta acción se escribe en Odoo y NO se puede revertir desde la UI
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModal(null); setConfirmChecked(false) }} disabled={busy}>Cancelar</Button>
            <Button onClick={doSetCanonical} disabled={!confirmChecked || busy}>
              {busy ? 'Procesando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal flag === */}
      <Dialog open={modal?.kind === 'flag'} onOpenChange={(open) => { if (!open) { setModal(null); setFlagNote('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar para revisar</DialogTitle>
            <DialogDescription>Solo Firestore. El cluster sube al inicio con badge naranja. No escribe a Odoo.</DialogDescription>
          </DialogHeader>
          <textarea
            value={flagNote}
            onChange={(e) => setFlagNote(e.target.value)}
            placeholder="Nota opcional..."
            className="min-h-[80px] w-full rounded border p-2 text-sm"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModal(null); setFlagNote('') }} disabled={busy}>Cancelar</Button>
            <Button onClick={doFlag} disabled={busy}>{busy ? 'Procesando...' : 'Marcar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal detail === */}
      <Dialog open={modal?.kind === 'detail'} onOpenChange={(open) => { if (!open) setModal(null) }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle cluster {modal?.kind === 'detail' && modal.cluster.clusterId}</DialogTitle>
            <DialogDescription>Información completa de cada payment del cluster — solo lectura.</DialogDescription>
          </DialogHeader>
          {modal?.kind === 'detail' && (
            <div className="space-y-3">
              {modal.cluster.members.map((m) => (
                <DetailMember key={m.id} m={m} />
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailMember({ m }: { m: OdooPaymentRowDto }) {
  return (
    <div className="rounded border p-3 text-sm">
      <p className="font-semibold">#{m.id} · {m.name ?? '(sin nombre)'} · {formatMoney(m.amount)}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
        <Row label="Viaje" value={m.tripName} />
        <Row label="Agente" value={m.agentName} />
        <Row label="Sale Order" value={m.saleOrderName} />
        <Row label="Partner" value={m.partnerName} />
        <Row label="Fecha" value={m.date} />
        <Row label="Journal" value={m.journalName} />
        <Row label="Método" value={m.paymentMethodLine} />
        <Row label="State" value={m.state} />
        <Row label="Memo" value={m.memo} />
        <Row label="Communication" value={m.communication} />
        <Row label="Captura tardía" value={m.reconcileDate} />
        <Row label="x_dup_status" value={m.xDupStatus} />
      </dl>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? '-'}</dd>
    </>
  )
}

function ClusterCard({
  cluster,
  onMarkCanonical,
  onDetail,
  onDismiss,
  onUndismiss,
  onFlag,
  onUnflag,
  busy,
}: {
  cluster: DuplicateClusterDto
  onMarkCanonical: (canonicalId: number) => void
  onDetail: () => void
  onDismiss: () => void
  onUndismiss: () => void
  onFlag: () => void
  onUnflag: () => void
  busy: boolean
}) {
  const isUnmarked = cluster.currentState === 'unmarked'
  const isCanonicalSet = cluster.currentState === 'canonical_set'
  const isInconsistent = cluster.currentState === 'inconsistent'
  const first = cluster.members[0]
  return (
    <Card className={cluster.flagged ? 'border-orange-400 border-2' : cluster.dismissed ? 'opacity-60' : undefined}>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium">{first.partnerName ?? '(sin partner)'}</p>
            <p className="text-sm text-muted-foreground">
              {formatMoney(first.amount)} · {cluster.members.length} miembros · {cluster.clusterId}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <SameBadge label="viaje" same={cluster.sameTrip ?? null} />
              <SameBadge label="agente" same={cluster.sameAgent ?? null} />
              {(cluster.maxDateDiffDays ?? 0) > 0 && (
                <Badge variant="outline">{cluster.maxDateDiffDays}d entre payments</Badge>
              )}
              {cluster.flagged && <Badge className="bg-orange-100 text-orange-800"><Flag className="mr-1 h-3 w-3 inline" /> Para revisar{cluster.flagNote ? `: ${cluster.flagNote}` : ''}</Badge>}
              {cluster.dismissed && <Badge variant="secondary">Dismissed</Badge>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isUnmarked && <Badge variant="secondary">Sin marcar</Badge>}
            {isCanonicalSet && (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle2 className="mr-1 h-3 w-3 inline" />
                Canónico #{cluster.canonicalId}
              </Badge>
            )}
            {isInconsistent && (
              <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3 inline" /> Inconsistente</Badge>
            )}
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={onDetail} disabled={busy}>
                <Info className="mr-1 h-3 w-3" /> Detalle
              </Button>
              {!cluster.dismissed && !cluster.flagged && (
                <Button size="sm" variant="outline" onClick={onFlag} disabled={busy}>
                  <Flag className="mr-1 h-3 w-3" /> Flag
                </Button>
              )}
              {cluster.flagged && (
                <Button size="sm" variant="outline" onClick={onUnflag} disabled={busy}>
                  <X className="mr-1 h-3 w-3" /> Quitar flag
                </Button>
              )}
              {!cluster.dismissed && (
                <Button size="sm" variant="outline" onClick={onDismiss} disabled={busy}>
                  <EyeOff className="mr-1 h-3 w-3" /> No es duplicado
                </Button>
              )}
              {cluster.dismissed && (
                <Button size="sm" variant="outline" onClick={onUndismiss} disabled={busy}>
                  <X className="mr-1 h-3 w-3" /> Revertir dismiss
                </Button>
              )}
            </div>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead>Viaje</TableHead>
              <TableHead>Agente</TableHead>
              <TableHead>Sale Order</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Journal</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>State</TableHead>
              <TableHead>x_dup_status</TableHead>
              {isUnmarked && !cluster.dismissed && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cluster.members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.id}</TableCell>
                <TableCell>{m.name ?? '-'}</TableCell>
                <TableCell className="max-w-[140px] truncate" title={m.memo ?? undefined}>{m.memo ?? '-'}</TableCell>
                <TableCell className="max-w-[140px] truncate" title={m.tripName ?? undefined}>{m.tripName ?? '-'}</TableCell>
                <TableCell>{m.agentName ?? '-'}</TableCell>
                <TableCell>{m.saleOrderName ?? '-'}</TableCell>
                <TableCell>{m.date ?? '-'}</TableCell>
                <TableCell>{formatMoney(m.amount)}</TableCell>
                <TableCell>{m.journalName ?? '-'}</TableCell>
                <TableCell>{m.paymentMethodLine ?? '-'}</TableCell>
                <TableCell>{m.state}</TableCell>
                <TableCell>{m.xDupStatus ?? '-'}</TableCell>
                {isUnmarked && !cluster.dismissed && (
                  <TableCell>
                    <Button size="sm" onClick={() => onMarkCanonical(m.id)} disabled={busy}>Marcar canónico</Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function SameBadge({ label, same }: { label: string; same: boolean | null }) {
  if (same === true) return <Badge className="bg-green-100 text-green-800">✓ Mismo {label}</Badge>
  if (same === false) return <Badge className="bg-orange-100 text-orange-800">⚠ {label} distintos</Badge>
  return <Badge variant="outline">? {label} desconocido</Badge>
}

function Counter({ label, value, variant }: { label: string; value: number; variant: 'green' | 'yellow' | 'gray' | 'red' }) {
  const colorMap = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    gray: 'bg-gray-100 text-gray-800',
    red: 'bg-red-100 text-red-800',
  }
  return (
    <div className="flex flex-col items-center">
      <span className={`rounded px-3 py-1 text-2xl font-semibold ${colorMap[variant]}`}>{value}</span>
      <span className="mt-1 text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
