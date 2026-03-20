'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import {
  CheckCircle2, XCircle, MessageSquare, AlertTriangle, CreditCard,
  Clock, Filter, ChevronDown, Loader2, ImageIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS,
  type PaymentStatus, type PaymentMethod,
} from '@/schemas/paymentSchema'

interface PaymentItem {
  id: string
  orderId: string
  agentId: string | null
  agentName: string | null
  tripName: string | null
  amountCents: number
  paymentMethod: PaymentMethod
  date: string | null
  registeredBy: string
  registeredByName: string | null
  receiptUrl: string | null
  bankName: string | null
  bankReference: string | null
  beneficiaryName: string | null
  concept: string | null
  sourceAccount: string | null
  destinationAccount: string | null
  status: PaymentStatus
  verifiedBy: string | null
  verifiedAt: string | null
  rejectionNote: string | null
  notes: string | null
  syncedToOdoo: boolean
  createdAt: string | null
  updatedAt: string | null
}

type ActionType = 'verify' | 'reject' | 'request_info'

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending_verification', label: 'Pendientes' },
  { value: 'verified', label: 'Verificados' },
  { value: 'rejected', label: 'Rechazados' },
  { value: 'info_requested', label: 'Info Solicitada' },
] as const

const STATUS_COLORS: Record<PaymentStatus, string> = {
  pending_verification: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  info_requested: 'bg-blue-100 text-blue-800',
}

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function isOverdue(createdAt: string | null): boolean {
  if (!createdAt) return false
  return Date.now() - new Date(createdAt).getTime() > FORTY_EIGHT_HOURS_MS
}

function PaymentSkeleton() {
  return (
    <Card className="p-4">
      <CardContent className="flex items-center gap-4 p-0">
        <Skeleton className="h-12 w-12 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-8 w-20" />
      </CardContent>
    </Card>
  )
}

export function VerificationPanel() {
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null)
  const [actionDialog, setActionDialog] = useState<{ type: ActionType; payment: PaymentItem } | null>(null)
  const [rejectionNote, setRejectionNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchPayments = useCallback(async () => {
    try {
      setError(null)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      params.set('pageSize', '50')

      const res = await fetch(`/api/payments?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `Error ${res.status}`)
      }
      const data = await res.json()
      setPayments(data.payments ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar pagos')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    setIsLoading(true)
    fetchPayments()
  }, [fetchPayments])

  const handleAction = useCallback(async () => {
    if (!actionDialog) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/payments/${actionDialog.payment.id}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionDialog.type,
          rejectionNote: actionDialog.type !== 'verify' ? rejectionNote : undefined,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `Error ${res.status}`)
      }

      // Refresh list
      setActionDialog(null)
      setRejectionNote('')
      setSelectedPayment(null)
      await fetchPayments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar accion')
    } finally {
      setIsSubmitting(false)
    }
  }, [actionDialog, rejectionNote, fetchPayments])

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/50 p-4">
        <CardContent className="flex items-center gap-3 p-0">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-800">Error al cargar pagos</p>
            <p className="text-xs text-red-600">{error}</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => { setIsLoading(true); fetchPayments() }}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Left panel: Payment list */}
      <div className="flex-1 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {payments.length} pago{payments.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Payment cards */}
        {isLoading ? (
          <div className="space-y-3">
            <PaymentSkeleton />
            <PaymentSkeleton />
            <PaymentSkeleton />
          </div>
        ) : payments.length === 0 ? (
          <Card className="p-8">
            <CardContent className="flex flex-col items-center justify-center p-0 text-center">
              <CreditCard className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {statusFilter === 'pending_verification'
                  ? 'No hay pagos pendientes de verificacion'
                  : 'No se encontraron pagos con este filtro'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => {
              const overdue = payment.status === 'pending_verification' && isOverdue(payment.createdAt)
              const isSelected = selectedPayment?.id === payment.id
              return (
                <Card
                  key={payment.id}
                  className={`cursor-pointer p-3 transition-colors hover:bg-muted/50 ${isSelected ? 'ring-2 ring-primary' : ''} ${overdue ? 'border-red-300 bg-red-50/30' : ''}`}
                  onClick={() => setSelectedPayment(payment)}
                >
                  <CardContent className="flex items-center gap-3 p-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                      {payment.receiptUrl ? (
                        <Image
                          src={payment.receiptUrl}
                          alt="Comprobante"
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded object-cover"
                          unoptimized
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {formatCurrency(payment.amountCents)}
                        </p>
                        {overdue && (
                          <Badge variant="destructive" className="text-[10px]">
                            <Clock className="mr-1 h-3 w-3" />
                            +48h
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {payment.tripName ?? 'Sin viaje'} — {payment.agentName ?? 'Sin agente'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[payment.paymentMethod]} — {formatDate(payment.date)}
                      </p>
                    </div>
                    <Badge className={STATUS_COLORS[payment.status]}>
                      {PAYMENT_STATUS_LABELS[payment.status]}
                    </Badge>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Right panel: Detail view */}
      <div className="w-full lg:w-96">
        {selectedPayment ? (
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Detalle del Pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Receipt image — click to enlarge */}
              <button
                type="button"
                className="flex h-48 w-full items-center justify-center rounded-lg bg-muted transition-opacity hover:opacity-80"
                onClick={() => selectedPayment.receiptUrl && setImagePreview(selectedPayment.receiptUrl)}
                disabled={!selectedPayment.receiptUrl}
              >
                {selectedPayment.receiptUrl ? (
                  <>
                    <Image
                      src={selectedPayment.receiptUrl}
                      alt="Comprobante de pago"
                      width={320}
                      height={192}
                      className="h-full w-full rounded-lg object-contain"
                      unoptimized
                    />
                  </>
                ) : (
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-1 text-xs text-muted-foreground">Sin comprobante</p>
                  </div>
                )}
              </button>
              {selectedPayment.receiptUrl && (
                <p className="text-center text-[10px] text-muted-foreground">Click en la imagen para ampliar</p>
              )}

              {/* Payment details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monto</span>
                  <span className="font-medium">{formatCurrency(selectedPayment.amountCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Metodo</span>
                  <span>{PAYMENT_METHOD_LABELS[selectedPayment.paymentMethod]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha del pago</span>
                  <span>{formatDate(selectedPayment.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registrado por</span>
                  <span>{selectedPayment.registeredByName ?? selectedPayment.registeredBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Viaje</span>
                  <span className="truncate pl-4 text-right">{selectedPayment.tripName ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agente</span>
                  <span>{selectedPayment.agentName ?? 'Sin asignar'}</span>
                </div>
                {selectedPayment.bankName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Banco</span>
                    <span className="font-medium">{selectedPayment.bankName}</span>
                  </div>
                )}
                {selectedPayment.bankReference && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Referencia</span>
                    <span className="font-mono font-medium">{selectedPayment.bankReference}</span>
                  </div>
                )}
                {selectedPayment.beneficiaryName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Beneficiario</span>
                    <span>{selectedPayment.beneficiaryName}</span>
                  </div>
                )}
                {selectedPayment.concept && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Concepto</span>
                    <span className="truncate pl-4 text-right font-medium">{selectedPayment.concept}</span>
                  </div>
                )}
                {(selectedPayment.sourceAccount || selectedPayment.destinationAccount) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cuentas</span>
                    <span className="font-mono text-xs">
                      {selectedPayment.sourceAccount && `Origen: •${selectedPayment.sourceAccount}`}
                      {selectedPayment.sourceAccount && selectedPayment.destinationAccount && ' → '}
                      {selectedPayment.destinationAccount && `Destino: •${selectedPayment.destinationAccount}`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registrado</span>
                  <span>{formatDate(selectedPayment.createdAt)}</span>
                </div>
                {selectedPayment.notes && (
                  <div>
                    <span className="text-muted-foreground">Notas</span>
                    <p className="mt-1 rounded bg-muted p-2 text-xs">{selectedPayment.notes}</p>
                  </div>
                )}
                {selectedPayment.rejectionNote && (
                  <div>
                    <span className="text-muted-foreground">Motivo de rechazo</span>
                    <p className="mt-1 rounded bg-red-50 p-2 text-xs text-red-700">{selectedPayment.rejectionNote}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {(selectedPayment.status === 'pending_verification' || selectedPayment.status === 'info_requested') && (
                <div className="flex gap-2 border-t pt-3">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => setActionDialog({ type: 'verify', payment: selectedPayment })}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setActionDialog({ type: 'reject', payment: selectedPayment })}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" />
                    Rechazar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActionDialog({ type: 'request_info', payment: selectedPayment })}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {selectedPayment.status === 'verified' && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Verificado el {formatDate(selectedPayment.verifiedAt)}
                </div>
              )}

              {selectedPayment.status === 'rejected' && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <XCircle className="h-4 w-4" />
                  Rechazado
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="p-8">
            <CardContent className="flex flex-col items-center justify-center p-0 text-center">
              <ChevronDown className="mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Selecciona un pago para ver el detalle</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action confirmation dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => { if (!open) { setActionDialog(null); setRejectionNote('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === 'verify' && 'Aprobar Pago'}
              {actionDialog?.type === 'reject' && 'Rechazar Pago'}
              {actionDialog?.type === 'request_info' && 'Solicitar Informacion'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.type === 'verify' &&
                `Confirmas la aprobacion del pago de ${actionDialog?.payment ? formatCurrency(actionDialog.payment.amountCents) : ''}?`}
              {actionDialog?.type === 'reject' &&
                'Indica el motivo del rechazo. El agente recibira una notificacion.'}
              {actionDialog?.type === 'request_info' &&
                'Indica que informacion adicional necesitas.'}
            </DialogDescription>
          </DialogHeader>

          {actionDialog?.type !== 'verify' && (
            <Textarea
              placeholder={actionDialog?.type === 'reject' ? 'Motivo del rechazo...' : 'Que informacion necesitas?'}
              value={rejectionNote}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectionNote(e.target.value)}
              rows={3}
            />
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setActionDialog(null); setRejectionNote('') }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAction}
              disabled={isSubmitting || (actionDialog?.type === 'reject' && rejectionNote.length < 5)}
              className={actionDialog?.type === 'verify' ? 'bg-green-600 hover:bg-green-700' : ''}
              variant={actionDialog?.type === 'reject' ? 'destructive' : 'default'}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionDialog?.type === 'verify' && 'Confirmar Aprobacion'}
              {actionDialog?.type === 'reject' && 'Confirmar Rechazo'}
              {actionDialog?.type === 'request_info' && 'Enviar Solicitud'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen image preview */}
      <Dialog open={!!imagePreview} onOpenChange={(open) => { if (!open) setImagePreview(null) }}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Comprobante de pago</DialogTitle>
            <DialogDescription>Vista ampliada del comprobante</DialogDescription>
          </DialogHeader>
          {imagePreview && (
            <div className="flex items-center justify-center overflow-auto">
              <Image
                src={imagePreview}
                alt="Comprobante de pago ampliado"
                width={1200}
                height={1600}
                className="max-h-[85vh] w-auto object-contain"
                unoptimized
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
