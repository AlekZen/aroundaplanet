'use client'

import { useEffect, useState } from 'react'
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore'
import { firebaseApp } from '@/lib/firebase/client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ResolveConflictModal } from './ResolveConflictModal'
import type { PaymentConflict } from '@/schemas/paymentConflictSchema'

const db = getFirestore(firebaseApp)

interface ConflictDoc extends PaymentConflict {
  conflictId: string
}

interface PaymentInfo {
  clientName?: string
  amount?: number
}

function humanizeTs(ts: unknown): string {
  if (!ts) return '—'
  let d: Date
  if (typeof ts === 'string') d = new Date(ts)
  else if (ts instanceof Date) d = ts
  else {
    const obj = ts as Record<string, unknown>
    if (typeof obj.seconds === 'number') d = new Date(obj.seconds * 1000)
    else return '—'
  }
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'hace menos de 1 min'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `hace ${diffHrs} h`
  return d.toLocaleDateString('es-MX')
}

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

const FIELD_LABELS: Record<string, string> = {
  amount: 'Monto',
  memo: 'Memo',
  paymentDate: 'Fecha de pago',
}

export function ConflictsTable() {
  const [conflicts, setConflicts] = useState<ConflictDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [paymentsById, setPaymentsById] = useState<Record<string, PaymentInfo>>({})
  const [selected, setSelected] = useState<ConflictDoc | null>(null)

  useEffect(() => {
    const q = query(
      collection(db, 'paymentConflicts'),
      where('resolvedAt', '==', null),
      orderBy('detectedAt', 'desc'),
      limit(100),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: ConflictDoc[] = snap.docs.map((d) => ({
          ...(d.data() as PaymentConflict),
          conflictId: d.id,
        }))
        setConflicts(docs)
        setLoading(false)
      },
      (err) => {
        console.error('ConflictsTable onSnapshot error:', err)
        setLoading(false)
      },
    )

    return unsub
  }, [])

  // Cargar datos de payment para clientName/amount
  useEffect(() => {
    const paymentIds = [...new Set(conflicts.map((c) => c.paymentId))]
    const missing = paymentIds.filter((id) => !(id in paymentsById))
    if (missing.length === 0) return

    void Promise.all(
      missing.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, 'payments', id))
          if (snap.exists()) {
            const data = snap.data()
            return [id, { clientName: data.clientName, amount: data.amount }] as const
          }
          return [id, {}] as const
        } catch {
          return [id, {}] as const
        }
      }),
    ).then((results) => {
      setPaymentsById((prev) => {
        const next = { ...prev }
        for (const [id, info] of results) next[id] = info
        return next
      })
    })
  }, [conflicts, paymentsById])

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full animate-pulse" />
        ))}
      </div>
    )
  }

  if (conflicts.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        Sin conflictos pendientes — todo sincronizado.
      </p>
    )
  }

  return (
    <>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pago</TableHead>
              <TableHead>Campo</TableHead>
              <TableHead>Valor Firestore</TableHead>
              <TableHead>Valor Odoo</TableHead>
              <TableHead>Detectado</TableHead>
              <TableHead>Sources</TableHead>
              <TableHead className="w-28">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conflicts.map((c) => {
              const payment = paymentsById[c.paymentId] ?? {}
              const shortId = c.paymentId.slice(0, 8)
              return (
                <TableRow key={c.conflictId}>
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium">{payment.clientName ?? '—'}</p>
                      {payment.amount !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payment.amount / 100)}
                        </p>
                      )}
                      <a
                        href={`/admin/verification/${c.paymentId}`}
                        className="text-xs text-primary underline"
                        title={c.paymentId}
                      >
                        {shortId}…
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{FIELD_LABELS[c.field] ?? c.field}</Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{formatFieldValue(c.field, c.firestoreValue)}</p>
                    <p className="text-xs text-muted-foreground">{humanizeTs(c.firestoreWrittenAt)}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{formatFieldValue(c.field, c.odooValue)}</p>
                    <p className="text-xs text-muted-foreground">{humanizeTs(c.odooWrittenAt)}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {humanizeTs(c.detectedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.firestoreSource && (
                        <Badge variant="secondary" className="text-xs">{c.firestoreSource}</Badge>
                      )}
                      {c.odooSource && (
                        <Badge variant="outline" className="text-xs">{c.odooSource}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setSelected(c)}>
                      Resolver
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <ResolveConflictModal
          conflict={selected}
          open={true}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
