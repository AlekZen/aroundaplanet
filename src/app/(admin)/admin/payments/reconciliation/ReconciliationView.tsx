'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type {
  ReconciliationGetResponse,
  ReconciliationCandidate,
  FirestorePaymentSummary,
} from '@/schemas/reconciliationSchema'

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function ReconciliationView() {
  const [data, setData] = useState<ReconciliationGetResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/payments/reconciliation')
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.message ?? 'Error cargando reconciliación')
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Error de red al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const confirm = useCallback(async (c: ReconciliationCandidate) => {
    setBusyId(c.firestoreId)
    try {
      const res = await fetch(`/api/admin/payments/reconciliation/${c.firestoreId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ odooPaymentId: c.odooId, confidence: c.confidence }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.message ?? `Error: ${json.code}`)
        return
      }
      toast.success(`Enlazado FS ${c.firestoreId} ↔ Odoo ${c.odooId}`)
      await load()
    } finally {
      setBusyId(null)
    }
  }, [load])

  const reject = useCallback(async (c: ReconciliationCandidate) => {
    const reason = window.prompt('Razón del rechazo (≥3 caracteres):')
    if (!reason || reason.length < 3) return
    setBusyId(c.firestoreId)
    try {
      const res = await fetch(`/api/admin/payments/reconciliation/${c.firestoreId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ odooPaymentId: c.odooId, reason }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.message ?? `Error: ${json.code}`)
        return
      }
      toast.success('Match rechazado y registrado en auditoría')
      await load()
    } finally {
      setBusyId(null)
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
        <CardContent className="flex flex-wrap gap-4 p-4">
          <Counter label="High" value={data.summary.high} variant="green" />
          <Counter label="Medium" value={data.summary.medium} variant="yellow" />
          <Counter label="Low" value={data.summary.low} variant="orange" />
          <Counter label="Sin match" value={data.summary.none} variant="gray" />
          <Counter label="Enlazados" value={data.summary.matched} variant="blue" />
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={['high', 'medium']}>
        <AccordionItem value="high">
          <AccordionTrigger>High Confidence ({data.buckets.high.length})</AccordionTrigger>
          <AccordionContent>
            <CandidateList candidates={data.buckets.high} onConfirm={confirm} onReject={reject} busyId={busyId} />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="medium">
          <AccordionTrigger>Medium ({data.buckets.medium.length})</AccordionTrigger>
          <AccordionContent>
            <CandidateList candidates={data.buckets.medium} onConfirm={confirm} onReject={reject} busyId={busyId} />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="low">
          <AccordionTrigger>Low ({data.buckets.low.length})</AccordionTrigger>
          <AccordionContent>
            <CandidateList candidates={data.buckets.low} onConfirm={confirm} onReject={reject} busyId={busyId} />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="none">
          <AccordionTrigger>Sin match ({data.buckets.none.length})</AccordionTrigger>
          <AccordionContent>
            <NoneList items={data.buckets.none} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

function Counter({ label, value, variant }: { label: string; value: number; variant: 'green' | 'yellow' | 'orange' | 'gray' | 'blue' }) {
  const colorMap = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    orange: 'bg-orange-100 text-orange-800',
    gray: 'bg-gray-100 text-gray-800',
    blue: 'bg-blue-100 text-blue-800',
  }
  return (
    <div className="flex flex-col items-center">
      <span className={`rounded px-3 py-1 text-2xl font-semibold ${colorMap[variant]}`}>{value}</span>
      <span className="mt-1 text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function CandidateList({
  candidates,
  onConfirm,
  onReject,
  busyId,
}: {
  candidates: ReconciliationCandidate[]
  onConfirm: (c: ReconciliationCandidate) => void
  onReject: (c: ReconciliationCandidate) => void
  busyId: string | null
}) {
  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No hay candidatos en este bucket.</p>
  }
  return (
    <div className="space-y-3">
      {candidates.map((c) => {
        const missingName = c.warnings.includes('missing_clientName')
        return (
          <Card key={c.firestoreId}>
            <CardContent className="p-4 space-y-3">
              {missingName && (
                <div className="flex items-center gap-2 rounded bg-orange-50 p-2 text-sm text-orange-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Resolver clientName desde orders.contactName antes de matchear</span>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Firestore</p>
                  <p className="font-medium">{c.firestorePayment.clientName ?? '(sin nombre)'}</p>
                  <p className="text-sm">{formatMoney(c.firestorePayment.amount)} · {c.firestorePayment.paymentDate ?? '-'}</p>
                  <p className="text-xs text-muted-foreground">Agente: {c.firestorePayment.agentName ?? '-'} · Método: {c.firestorePayment.paymentMethod ?? '-'}</p>
                  <p className="text-xs text-muted-foreground">ID: {c.firestoreId}</p>
                </div>
                <div className="rounded border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Odoo</p>
                  <p className="font-medium">{c.odooPayment.partnerName ?? '(sin partner)'}</p>
                  <p className="text-sm">{formatMoney(c.odooPayment.amount)} · {c.odooPayment.date ?? '-'}</p>
                  <p className="text-xs text-muted-foreground">Journal: {c.odooPayment.journalName ?? '-'} · State: {c.odooPayment.state}</p>
                  <p className="text-xs text-muted-foreground">ID: {c.odooId}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{c.confidence}</Badge>
                {c.reasons.map((r, i) => <Badge key={i} variant="outline">{r}</Badge>)}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => onConfirm(c)} disabled={busyId === c.firestoreId || missingName} size="sm">
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Confirmar match
                </Button>
                <Button onClick={() => onReject(c)} disabled={busyId === c.firestoreId} variant="outline" size="sm">
                  <XCircle className="mr-1 h-4 w-4" /> No es match
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function NoneList({ items }: { items: FirestorePaymentSummary[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground py-4">Sin pagos pendientes.</p>
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <Card key={i.firestoreId}>
          <CardContent className="p-3">
            <p className="text-sm">
              <strong>{i.clientName ?? '(sin nombre)'}</strong> · {formatMoney(i.amount)} · {i.paymentDate ?? '-'}
            </p>
            {i.warnings.length > 0 && (
              <p className="mt-1 text-xs text-orange-700">⚠ {i.warnings.join(', ')}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
