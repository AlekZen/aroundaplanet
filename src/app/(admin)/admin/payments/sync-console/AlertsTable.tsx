'use client'

/**
 * AlertsTable — Story 9.6, Task 4.1
 *
 * Lista realtime de alertas operativas abiertas (status = 'open').
 * Agrupadas en acordeones por tipo: odoo_canceled, attachment_failed,
 * orphan_payment, unknown_method.
 *
 * Cada alerta se enriquece con datos del pago correspondiente
 * (clientName, amount, paymentMethod) via batch fetch a Firestore.
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
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
import { toast } from 'sonner'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
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
import { PAYMENT_ALERT_TYPES } from '@/schemas/paymentAlertSchema'
import type { PaymentAlertType } from '@/schemas/paymentAlertSchema'
import { PAYMENT_METHOD_LABELS } from '@/schemas/paymentSchema'
import type { PaymentMethod } from '@/schemas/paymentSchema'

const db = getFirestore(firebaseApp)

const RUNBOOK_LINK = '/admin/payments/sync-console#runbook'

const ALERT_TYPE_LABELS: Record<PaymentAlertType, string> = {
  odoo_canceled: 'Odoo cancelado',
  attachment_failed: 'Adjunto fallido',
  orphan_payment: 'Pago huérfano',
  unknown_method: 'Método desconocido',
}

const ALERT_TYPE_COLORS: Record<PaymentAlertType, string> = {
  odoo_canceled: 'bg-red-100 text-red-800 border-red-200',
  attachment_failed: 'bg-orange-100 text-orange-800 border-orange-200',
  orphan_payment: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  unknown_method: 'bg-purple-100 text-purple-800 border-purple-200',
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDate(value: unknown): string {
  if (!value) return '—'
  if (typeof value === 'string') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? value : d.toLocaleString('es-MX')
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate(): Date }).toDate().toLocaleString('es-MX')
  }
  return String(value)
}

interface AlertDoc {
  id: string
  paymentId: string
  type: PaymentAlertType
  status: string
  odooPaymentId?: number | null
  odooState?: string | null
  firestoreStatus?: string | null
  detectedAt?: unknown
  runId?: string | null
}

interface PaymentSummary {
  clientName?: string | null
  clientPhone?: string | null
  amount?: number | null
  paymentMethod?: string | null
}

interface DismissAlertState {
  alertId: string
  type: PaymentAlertType
}

interface MarkCanceledState {
  paymentId: string
  alertId: string
}

// Auth via cookie de sesión (__session) — same-origin fetch la envía automáticamente.

export function AlertsTable() {
  const [alerts, setAlerts] = useState<AlertDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [paymentMap, setPaymentMap] = useState<Map<string, PaymentSummary>>(new Map())
  const [busyId, setBusyId] = useState<string | null>(null)

  // Modal: desestimar
  const [dismissState, setDismissState] = useState<DismissAlertState | null>(null)
  const [dismissNote, setDismissNote] = useState('')
  const [dismissBusy, setDismissBusy] = useState(false)

  // Modal: marcar cancelado
  const [markCanceledState, setMarkCanceledState] = useState<MarkCanceledState | null>(null)
  const [cancelNote, setCancelNote] = useState('')
  const [cancelBusy, setCancelBusy] = useState(false)

  // Modal: marcar como manual (orphan_payment)
  const [markManualState, setMarkManualState] = useState<DismissAlertState | null>(null)
  const [manualNote, setManualNote] = useState('')
  const [manualBusy, setManualBusy] = useState(false)

  // onSnapshot sobre paymentAlerts
  useEffect(() => {
    const q = query(
      collection(db, 'paymentAlerts'),
      where('status', '==', 'open'),
      orderBy('detectedAt', 'desc'),
      limit(100),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: AlertDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AlertDoc, 'id'>),
        }))
        setAlerts(docs)
        setLoading(false)
      },
      (err) => {
        console.error('[AlertsTable] onSnapshot error', err)
        toast.error('Error cargando alertas')
        setLoading(false)
      },
    )

    return () => unsub()
  }, [])

  // Enriquecer pagos: batch fetch cuando cambian alerts
  useEffect(() => {
    const uniqueIds = [...new Set(alerts.map((a) => a.paymentId))]
    if (uniqueIds.length === 0) return

    void Promise.all(
      uniqueIds.map(async (pid) => {
        const snap = await getDoc(doc(db, 'payments', pid))
        return { pid, data: snap.exists() ? (snap.data() as PaymentSummary) : null }
      }),
    ).then((results) => {
      setPaymentMap((prev) => {
        const next = new Map(prev)
        for (const { pid, data } of results) {
          if (data) next.set(pid, data)
        }
        return next
      })
    })
  }, [alerts])

  // Agrupar por tipo
  const byType = useMemo(() => {
    const map = new Map<PaymentAlertType, AlertDoc[]>()
    for (const t of PAYMENT_ALERT_TYPES) map.set(t, [])
    for (const a of alerts) {
      const list = map.get(a.type)
      if (list) list.push(a)
    }
    return map
  }, [alerts])

  const handleRetryAttachment = useCallback(async (paymentId: string) => {
    setBusyId(paymentId)
    try {
      const res = await fetch(`/api/payments/${paymentId}/retry-attachment`, {
        method: 'POST',
      })
      if (res.status === 501) {
        toast.info('Pendiente Story 9.4')
      } else if (res.ok) {
        toast.success('Reintento de adjunto enviado')
      } else {
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
        toast.error((json.message as string | undefined) ?? 'Error al reintentar adjunto')
      }
    } catch {
      toast.error('Error de red al reintentar adjunto')
    } finally {
      setBusyId(null)
    }
  }, [])

  const handleRetryPush = useCallback(async (paymentId: string) => {
    setBusyId(paymentId)
    try {
      const res = await fetch(`/api/payments/${paymentId}/retry-odoo-push`, {
        method: 'POST',
      })
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (res.ok) {
        toast.success('Push reintentado · synced')
      } else if (res.status === 502) {
        toast.error(`Push falló: ${(json.error as string | undefined) ?? 'Error desconocido'}`)
      } else {
        toast.error((json.message as string | undefined) ?? 'Error inesperado')
      }
    } catch {
      toast.error('Error de red al reintentar push')
    } finally {
      setBusyId(null)
    }
  }, [])

  const handleDismiss = useCallback(async () => {
    if (!dismissState) return
    if (dismissNote.trim().length < 5) {
      toast.error('La nota debe tener al menos 5 caracteres')
      return
    }
    setDismissBusy(true)
    try {
      const res = await fetch(`/api/payment-alerts/${dismissState.alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'dismissed', resolutionNote: dismissNote.trim() }),
      })
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (res.ok) {
        toast.success('Alerta desestimada')
        setDismissState(null)
      } else if (res.status === 409) {
        toast.info('Alerta ya resuelta')
        setDismissState(null)
      } else {
        toast.error((json.message as string | undefined) ?? 'Error al desestimar')
      }
    } catch {
      toast.error('Error de red al desestimar')
    } finally {
      setDismissBusy(false)
    }
  }, [dismissState, dismissNote])

  const handleMarkCanceled = useCallback(async () => {
    if (!markCanceledState) return
    setCancelBusy(true)
    try {
      const res = await fetch(`/api/payments/${markCanceledState.paymentId}/mark-canceled`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alertId: markCanceledState.alertId,
          note: cancelNote.trim() || undefined,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (res.ok) {
        toast.success('Pago marcado como cancelado en Firestore')
        setMarkCanceledState(null)
      } else {
        toast.error((json.message as string | undefined) ?? 'Error al marcar cancelado')
      }
    } catch {
      toast.error('Error de red')
    } finally {
      setCancelBusy(false)
    }
  }, [markCanceledState, cancelNote])

  const handleMarkManual = useCallback(async () => {
    if (!markManualState) return
    if (manualNote.trim().length < 5) {
      toast.error('La nota es obligatoria (mín. 5 chars)')
      return
    }
    setManualBusy(true)
    try {
      const res = await fetch(`/api/payment-alerts/${markManualState.alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'dismissed', resolutionNote: `manual: ${manualNote.trim()}` }),
      })
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (res.ok) {
        toast.success('Pago marcado como manual')
        setMarkManualState(null)
      } else {
        toast.error((json.message as string | undefined) ?? 'Error al marcar como manual')
      }
    } catch {
      toast.error('Error de red')
    } finally {
      setManualBusy(false)
    }
  }, [markManualState, manualNote])

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Sin alertas operativas abiertas.
      </p>
    )
  }

  return (
    <>
      <Accordion type="multiple" className="space-y-2">
        {PAYMENT_ALERT_TYPES.map((type) => {
          const list = byType.get(type) ?? []
          if (list.length === 0) return null
          return (
            <AccordionItem key={type} value={type} className="rounded-md border">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${ALERT_TYPE_COLORS[type]}`}
                  >
                    {ALERT_TYPE_LABELS[type]}
                  </Badge>
                  <span className="text-sm font-medium">{list.length} alerta{list.length !== 1 ? 's' : ''}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  {list.map((alert) => {
                    const payment = paymentMap.get(alert.paymentId)
                    const busy = busyId === alert.paymentId
                    const methodLabel =
                      payment?.paymentMethod && payment.paymentMethod in PAYMENT_METHOD_LABELS
                        ? PAYMENT_METHOD_LABELS[payment.paymentMethod as PaymentMethod]
                        : (payment?.paymentMethod ?? '—')

                    return (
                      <div
                        key={alert.id}
                        className="rounded-sm border bg-muted/30 p-3 space-y-2"
                      >
                        {/* Info pago */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <span>
                            <span className="text-muted-foreground">Cliente:</span>{' '}
                            <strong>{payment?.clientName ?? alert.paymentId}</strong>
                          </span>
                          {payment?.clientPhone ? (
                            <span>
                              <span className="text-muted-foreground">Tel:</span>{' '}
                              {payment.clientPhone}
                            </span>
                          ) : null}
                          <span>
                            <span className="text-muted-foreground">Monto:</span>{' '}
                            {payment?.amount != null ? formatMoney(payment.amount) : '—'}
                          </span>
                          <span>
                            <span className="text-muted-foreground">Método:</span>{' '}
                            {methodLabel}
                          </span>
                          {alert.odooPaymentId ? (
                            <span>
                              <span className="text-muted-foreground">Odoo #:</span>{' '}
                              {alert.odooPaymentId}
                            </span>
                          ) : null}
                          {alert.odooState ? (
                            <span>
                              <span className="text-muted-foreground">Estado Odoo:</span>{' '}
                              {alert.odooState}
                            </span>
                          ) : null}
                          <span>
                            <span className="text-muted-foreground">Detectado:</span>{' '}
                            {formatDate(alert.detectedAt)}
                          </span>
                          {alert.runId ? (
                            <span className="text-xs text-muted-foreground">
                              run: {alert.runId}
                            </span>
                          ) : null}
                        </div>

                        {/* Acciones por tipo */}
                        <div className="flex flex-wrap gap-2">
                          {type === 'odoo_canceled' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                  setCancelNote('')
                                  setMarkCanceledState({
                                    paymentId: alert.paymentId,
                                    alertId: alert.id,
                                  })
                                }}
                              >
                                Marcar Firestore canceled
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => {
                                  setDismissNote('')
                                  setDismissState({ alertId: alert.id, type })
                                }}
                              >
                                Desestimar
                              </Button>
                              <a
                                href={`/admin/payments/${alert.paymentId}`}
                                className="inline-flex items-center rounded-sm px-3 py-1 text-sm border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                              >
                                Ver pago
                              </a>
                            </>
                          )}

                          {type === 'attachment_failed' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void handleRetryAttachment(alert.paymentId)}
                              >
                                {busy ? 'Reintentando…' : 'Reintentar subida'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => {
                                  setDismissNote('')
                                  setDismissState({ alertId: alert.id, type })
                                }}
                              >
                                Desestimar
                              </Button>
                              <a
                                href={`/admin/payments/${alert.paymentId}`}
                                className="inline-flex items-center rounded-sm px-3 py-1 text-sm border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                              >
                                Ver pago
                              </a>
                            </>
                          )}

                          {type === 'orphan_payment' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void handleRetryPush(alert.paymentId)}
                              >
                                {busy ? 'Reintentando…' : 'Reintentar idempotency lock'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                  setManualNote('')
                                  setMarkManualState({ alertId: alert.id, type })
                                }}
                              >
                                Marcar como manual
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => {
                                  setDismissNote('')
                                  setDismissState({ alertId: alert.id, type })
                                }}
                              >
                                Desestimar
                              </Button>
                            </>
                          )}

                          {type === 'unknown_method' && (
                            <>
                              <a
                                href={RUNBOOK_LINK}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center rounded-sm px-3 py-1 text-sm border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                              >
                                Editar mapping
                              </a>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => {
                                  setDismissNote('')
                                  setDismissState({ alertId: alert.id, type })
                                }}
                              >
                                Desestimar
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      {/* Modal: desestimar alerta */}
      <Dialog
        open={dismissState !== null}
        onOpenChange={(open) => {
          if (!open) setDismissState(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desestimar alerta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            La alerta será marcada como desestimada. Agrega una nota explicando el motivo.
          </p>
          <div className="space-y-2">
            <Label htmlFor="dismiss-note">Nota de resolución (mín. 5 chars)</Label>
            <Textarea
              id="dismiss-note"
              value={dismissNote}
              onChange={(e) => setDismissNote(e.target.value)}
              placeholder="Ej: Error transitorio corregido manualmente…"
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDismissState(null)} disabled={dismissBusy}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDismiss()}
              disabled={dismissBusy || dismissNote.trim().length < 5}
            >
              {dismissBusy ? 'Desestimando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: marcar Firestore canceled */}
      <Dialog
        open={markCanceledState !== null}
        onOpenChange={(open) => {
          if (!open) setMarkCanceledState(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar pago como cancelado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            El pago en Firestore cambiará su estado a <strong>rechazado</strong> para reflejar la
            cancelación en Odoo. Esta acción no se puede deshacer automáticamente.
          </p>
          <div className="space-y-2">
            <Label htmlFor="cancel-note">Nota (opcional)</Label>
            <Textarea
              id="cancel-note"
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              placeholder="Contexto adicional sobre la cancelación…"
              rows={2}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setMarkCanceledState(null)}
              disabled={cancelBusy}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleMarkCanceled()}
              disabled={cancelBusy}
            >
              {cancelBusy ? 'Marcando…' : 'Confirmar cancelación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: marcar como manual (orphan_payment) */}
      <Dialog
        open={markManualState !== null}
        onOpenChange={(open) => {
          if (!open) setMarkManualState(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar pago como manual</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            La alerta se desestimará y el pago quedará marcado como gestionado manualmente fuera
            del sistema de sync.
          </p>
          <div className="space-y-2">
            <Label htmlFor="manual-note">Nota obligatoria (mín. 5 chars)</Label>
            <Textarea
              id="manual-note"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="Ej: El pago se procesó manualmente en Odoo por Paloma…"
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setMarkManualState(null)}
              disabled={manualBusy}
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleMarkManual()}
              disabled={manualBusy || manualNote.trim().length < 5}
            >
              {manualBusy ? 'Guardando…' : 'Confirmar gestión manual'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
