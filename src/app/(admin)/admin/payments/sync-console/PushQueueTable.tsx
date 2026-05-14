'use client'

/**
 * PushQueueTable — Story 9.6, Task 3.1
 *
 * Tabla realtime de pagos en cola de push a Odoo (odooSyncStatus: pending | error).
 * Permite reintentar el push o descartar con motivo.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore'
import { firebaseApp } from '@/lib/firebase/client'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { SyncStatusBadge } from '@/components/payments/SyncStatusBadge'
import { PAYMENT_METHOD_LABELS } from '@/schemas/paymentSchema'
import type { PaymentMethod } from '@/schemas/paymentSchema'
import type { AnyTimestamp } from '@/lib/odoo/sync/time'

const db = getFirestore(firebaseApp)

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

interface QueuedPayment {
  id: string
  clientName?: string | null
  clientPhone?: string | null
  amount?: number | null
  paymentMethod?: string | null
  odooSyncStatus?: 'pending' | 'error' | 'dismissed' | null
  odooLastError?: string | null
  syncRetryCount?: number | null
  verifiedAt?: AnyTimestamp
  odooPaymentId?: number | null
  odooJournalName?: string | null
  odooSyncedAt?: AnyTimestamp
  odooSyncDismissedReason?: string | null
  status?: string
}

interface DismissState {
  paymentId: string
  clientName: string
}

// Auth via cookie de sesión (__session) — same-origin fetch la envía automáticamente.
// No es necesario pasar Bearer token; requirePermission en el servidor valida la cookie.

export function PushQueueTable() {
  const [payments, setPayments] = useState<QueuedPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dismissState, setDismissState] = useState<DismissState | null>(null)
  const [dismissReason, setDismissReason] = useState('')
  const [dismissBusy, setDismissBusy] = useState(false)

  useEffect(() => {
    // Filtramos odooPaymentId == null client-side para evitar el bug del Web SDK
    // con where(..., '==', null) + orderBy (Missing or insufficient permissions en prod).
    // La colección es chica (decenas), sin impacto de performance.
    const q = query(
      collection(db, 'payments'),
      where('status', '==', 'verified'),
      orderBy('verifiedAt', 'desc'),
      limit(200),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: QueuedPayment[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<QueuedPayment, 'id'>),
          }))
          // Filtro client-side: sin odooPaymentId + excluir dismissed
          .filter((p) => p.odooPaymentId == null)
          .filter((p) => p.odooSyncStatus !== 'dismissed')
          .slice(0, 100)
        setPayments(docs)
        setLoading(false)
      },
      (err) => {
        console.error('[PushQueueTable] onSnapshot error', err)
        toast.error('Error cargando cola de sync')
        setLoading(false)
      },
    )

    return () => unsub()
  }, [])

  const handleRetry = useCallback(async (paymentId: string) => {
    setBusyId(paymentId)
    try {
      const res = await fetch(`/api/payments/${paymentId}/retry-odoo-push`, {
        method: 'POST',
      })
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (res.ok) {
        toast.success('Push reintentado · synced')
      } else if (res.status === 502) {
        const msg = (json.error as string | undefined) ?? 'Error desconocido'
        toast.error(`Push falló: ${msg}`)
      } else {
        const msg = (json.message as string | undefined) ?? 'Error inesperado'
        toast.error(msg)
      }
    } catch {
      toast.error('Error de red al reintentar push')
    } finally {
      setBusyId(null)
    }
  }, [])

  const openDismiss = useCallback((payment: QueuedPayment) => {
    setDismissReason('')
    setDismissState({
      paymentId: payment.id,
      clientName: payment.clientName ?? payment.id,
    })
  }, [])

  const handleDismiss = useCallback(async () => {
    if (!dismissState) return
    if (dismissReason.trim().length < 5) {
      toast.error('El motivo debe tener al menos 5 caracteres')
      return
    }
    setDismissBusy(true)
    try {
      const res = await fetch(`/api/payments/${dismissState.paymentId}/dismiss-odoo-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: dismissReason.trim() }),
      })
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (res.ok) {
        toast.success('Pago descartado del sync')
        setDismissState(null)
      } else if (res.status === 409) {
        toast.info('Pago ya estaba descartado')
        setDismissState(null)
      } else {
        const msg = (json.message as string | undefined) ?? 'Error al descartar'
        toast.error(msg)
      }
    } catch {
      toast.error('Error de red al descartar')
    } finally {
      setDismissBusy(false)
    }
  }, [dismissState, dismissReason])

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Sin pagos pendientes en la cola de sync.
      </p>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Último error</TableHead>
            <TableHead>Reintentos</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => {
            const busy = busyId === p.id
            const methodLabel =
              p.paymentMethod && p.paymentMethod in PAYMENT_METHOD_LABELS
                ? PAYMENT_METHOD_LABELS[p.paymentMethod as PaymentMethod]
                : (p.paymentMethod ?? '—')
            const lastError = p.odooLastError ? truncate(p.odooLastError) : null

            return (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="font-medium">{p.clientName ?? '—'}</span>
                  {p.clientPhone ? (
                    <span className="block text-xs text-muted-foreground">{p.clientPhone}</span>
                  ) : null}
                </TableCell>
                <TableCell>{p.amount != null ? formatMoney(p.amount) : '—'}</TableCell>
                <TableCell>{methodLabel}</TableCell>
                <TableCell>
                  <SyncStatusBadge
                    payment={{ ...p, status: p.status ?? 'verified' }}
                    paymentId={p.id}
                  />
                </TableCell>
                <TableCell>
                  {lastError ? (
                    <span
                      className="cursor-help text-xs text-destructive"
                      title={p.odooLastError ?? undefined}
                    >
                      {lastError}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">{p.syncRetryCount ?? 0}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void handleRetry(p.id)}
                    >
                      {busy ? 'Reintentando…' : 'Reintentar push'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => openDismiss(p)}
                    >
                      Descartar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* Modal descartar */}
      <Dialog
        open={dismissState !== null}
        onOpenChange={(open) => {
          if (!open) setDismissState(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar sync de pago</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Este pago <strong>NO se sincronizará</strong> con Odoo. ¿Continuar?
          </p>
          <div className="space-y-2">
            <Label htmlFor="dismiss-reason">Motivo (mín. 5 chars)</Label>
            <Textarea
              id="dismiss-reason"
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder="Explica por qué se descarta este sync…"
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDismissState(null)}
              disabled={dismissBusy}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDismiss()}
              disabled={dismissBusy || dismissReason.trim().length < 5}
            >
              {dismissBusy ? 'Descartando…' : 'Confirmar descarte'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
