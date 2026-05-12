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
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { DuplicatesGetResponse, DuplicateClusterDto } from '@/schemas/dedupSchema'

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function DuplicatesView() {
  const [data, setData] = useState<DuplicatesGetResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmCluster, setConfirmCluster] = useState<{ cluster: DuplicateClusterDto; canonicalId: number } | null>(null)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/odoo/payments/duplicates')
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
  }, [])

  useEffect(() => { void load() }, [load])

  const doSetCanonical = useCallback(async () => {
    if (!confirmCluster) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/odoo/payments/duplicates/set-canonical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusterId: confirmCluster.cluster.clusterId,
          canonicalOdooId: confirmCluster.canonicalId,
          memberOdooIds: confirmCluster.cluster.members.map((m) => m.id),
        }),
      })
      const json = await res.json()
      if (res.status === 200) {
        toast.success(`Canónico #${confirmCluster.canonicalId} marcado en Odoo`)
      } else if (res.status === 207) {
        toast.warning(`Parcial: revisar verifyResult log #${json.logId}`)
      } else {
        toast.error(json.message ?? `Error ${res.status}: ${json.code}`)
      }
      setConfirmCluster(null)
      setConfirmChecked(false)
      await load()
    } catch {
      toast.error('Error de red')
    } finally {
      setBusy(false)
    }
  }, [confirmCluster, load])

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
        <CardContent className="flex flex-wrap gap-4 p-4">
          <Counter label="Total" value={data.summary.totalClusters} variant="gray" />
          <Counter label="Sin marcar" value={data.summary.unmarked} variant="yellow" />
          <Counter label="Canónico definido" value={data.summary.canonicalSet} variant="green" />
          <Counter label="Inconsistentes" value={data.summary.inconsistent} variant="red" />
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
              setConfirmCluster({ cluster: c, canonicalId })
              setConfirmChecked(false)
            }}
          />
        ))}
      </div>

      <Dialog open={!!confirmCluster} onOpenChange={(open) => { if (!open) { setConfirmCluster(null); setConfirmChecked(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar canónico — Acción irreversible</DialogTitle>
            <DialogDescription>
              Esta acción escribe en Odoo (campos <code>x_dup_status</code> y <code>x_canonical_payment_id</code>).
              No se borra ni cancela ningún pago. Una vez marcado, NO se puede revertir desde esta UI.
            </DialogDescription>
          </DialogHeader>
          {confirmCluster && (
            <div className="space-y-3">
              <div className="rounded border p-3 bg-green-50">
                <p className="text-sm font-medium text-green-900">Canónico: #{confirmCluster.canonicalId}</p>
              </div>
              <div className="rounded border p-3 bg-orange-50">
                <p className="text-sm font-medium text-orange-900">Secundarios:</p>
                <ul className="ml-4 list-disc text-sm text-orange-900">
                  {confirmCluster.cluster.members.filter((m) => m.id !== confirmCluster.canonicalId).map((m) => (
                    <li key={m.id}>#{m.id} · {m.name ?? 'sin nombre'} · {formatMoney(m.amount)} · {m.date}</li>
                  ))}
                </ul>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  className="h-4 w-4"
                />
                Entiendo que esta acción se escribe en Odoo y NO se puede revertir desde la UI
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmCluster(null); setConfirmChecked(false) }} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={doSetCanonical} disabled={!confirmChecked || busy}>
              {busy ? 'Procesando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ClusterCard({ cluster, onMarkCanonical }: { cluster: DuplicateClusterDto; onMarkCanonical: (canonicalId: number) => void }) {
  const isUnmarked = cluster.currentState === 'unmarked'
  const isCanonicalSet = cluster.currentState === 'canonical_set'
  const isInconsistent = cluster.currentState === 'inconsistent'
  const first = cluster.members[0]
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{first.partnerName ?? '(sin partner)'}</p>
            <p className="text-sm text-muted-foreground">
              {formatMoney(first.amount)} · {cluster.members.length} miembros · {cluster.clusterId}
            </p>
          </div>
          <div>
            {isUnmarked && <Badge variant="secondary">Sin marcar</Badge>}
            {isCanonicalSet && (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle2 className="mr-1 h-3 w-3 inline" />
                Canónico #{cluster.canonicalId}
              </Badge>
            )}
            {isInconsistent && (
              <Badge variant="destructive">
                <AlertTriangle className="mr-1 h-3 w-3 inline" />
                Inconsistente
              </Badge>
            )}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Journal</TableHead>
              <TableHead>State</TableHead>
              <TableHead>x_dup_status</TableHead>
              {isUnmarked && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cluster.members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.id}</TableCell>
                <TableCell>{m.name ?? '-'}</TableCell>
                <TableCell>{m.ref ?? '-'}</TableCell>
                <TableCell>{m.date ?? '-'}</TableCell>
                <TableCell>{formatMoney(m.amount)}</TableCell>
                <TableCell>{m.journalName ?? '-'}</TableCell>
                <TableCell>{m.state}</TableCell>
                <TableCell>{m.xDupStatus ?? '-'}</TableCell>
                {isUnmarked && (
                  <TableCell>
                    <Button size="sm" onClick={() => onMarkCanonical(m.id)}>Marcar canónico</Button>
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
