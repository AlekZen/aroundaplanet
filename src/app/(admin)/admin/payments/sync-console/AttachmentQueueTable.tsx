'use client'

/**
 * AttachmentQueueTable — Story 9.4, Task 7
 *
 * Tabla realtime de pagos verificados cuyo comprobante aún no se subió a Odoo Documents.
 * Permite reintentar la subida del attachment vía POST /api/payments/{id}/retry-attachment.
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toEpochMs } from '@/lib/odoo/sync/time'
import type { AnyTimestamp } from '@/lib/odoo/sync/time'

const db = getFirestore(firebaseApp)

/** URL base del portal Odoo para abrir documentos */
const ODOO_BASE_URL = 'https://aroundaplanet.odoo.com'

/** Número máximo de reintentos antes de mostrar "Rate limit" */
const RETRY_RATE_LIMIT_CAP = 5

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

/** Convierte cualquier timestamp a "hace N días/horas/minutos" */
function humanizeAgo(ts: AnyTimestamp | undefined): string {
  const ms = toEpochMs(ts)
  if (ms <= 0) return '—'
  const diffMs = Date.now() - ms
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'hace un momento'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} día${days !== 1 ? 's' : ''}`
}

interface AttachmentPayment {
  id: string
  clientName?: string | null
  agentName?: string | null
  registeredByName?: string | null
  tripName?: string | null
  amountCents?: number | null
  odooPaymentId?: number | null
  odooSyncStatus?: string | null
  odooDocumentId?: string | null
  odooAttachmentSyncStatus?: 'never' | 'synced' | 'error' | 'skipped_no_receipt' | null
  odooAttachmentLastError?: string | null
  attachmentRetryCount?: number | null
  verifiedAt?: AnyTimestamp
  status?: string
}

// Auth via cookie de sesión (__session) — same-origin fetch la envía automáticamente.
// No es necesario pasar Bearer token; requirePermission en el servidor valida la cookie.

export function AttachmentQueueTable() {
  const [payments, setPayments] = useState<AttachmentPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    // Filtramos odooAttachmentSyncStatus client-side para evitar el bug del Web SDK
    // con where(..., '==', null) + orderBy (Missing or insufficient permissions en prod).
    // Solo traemos pagos verificados y ordenamos por verifiedAt desc.
    const q = query(
      collection(db, 'payments'),
      where('status', '==', 'verified'),
      orderBy('verifiedAt', 'desc'),
      limit(200),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: AttachmentPayment[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AttachmentPayment, 'id'>),
          }))
          // Solo pagos que ya tienen odooPaymentId (ya pusheados a Odoo)
          .filter((p) => p.odooPaymentId != null)
          // Solo los que tienen problema de attachment
          .filter(
            (p) =>
              p.odooAttachmentSyncStatus === 'error' ||
              p.odooAttachmentSyncStatus === 'never',
          )
          // Excluir dismissed del sync general
          .filter((p) => p.odooSyncStatus !== 'dismissed')
          .slice(0, 100)
        setPayments(docs)
        setLoading(false)
      },
      (err) => {
        console.error('[AttachmentQueueTable] onSnapshot error', err)
        toast.error('Error cargando cola de comprobantes')
        setLoading(false)
      },
    )

    return () => unsub()
  }, [])

  const handleRetry = useCallback(async (paymentId: string) => {
    setBusyId(paymentId)
    try {
      const res = await fetch(`/api/payments/${paymentId}/retry-attachment`, {
        method: 'POST',
      })
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>

      if (res.ok) {
        if (json.alreadyExists) {
          toast.info('El comprobante ya existía en Odoo Documents')
        } else {
          toast.success('Comprobante subido a Odoo Documents')
        }
      } else if (res.status === 429) {
        toast.error('Rate limit superado — intenta más tarde')
      } else if (res.status === 502) {
        const msg = (json.error as string | undefined) ?? 'Error de conexión con Odoo'
        toast.error(`Error al subir: ${msg}`)
      } else {
        const msg = (json.message as string | undefined) ?? 'Error inesperado'
        toast.error(msg)
      }
    } catch {
      toast.error('Error de red al reintentar comprobante')
    } finally {
      setBusyId(null)
    }
  }, [])

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
        Sin comprobantes con error — todos los pagos verificados tienen su comprobante en Odoo.
      </p>
    )
  }

  return (
    <>
      {/* Contexto explicativo para equipo admin no técnico */}
      <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
        <p className="font-medium">Comprobantes pendientes de Odoo Documents</p>
        <p className="mt-1 text-xs">
          Pagos verificados en Odoo cuyo comprobante (PDF/imagen) aún no se subió a Odoo
          Documents. El comprobante NO es bloqueante para contabilidad — el pago está
          sincronizado. Reintenta solo para que Paloma pueda revisar el comprobante en Odoo.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pago</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Estado attachment</TableHead>
            <TableHead>Documento Odoo</TableHead>
            <TableHead>Verificado</TableHead>
            <TableHead>Último error</TableHead>
            <TableHead>Reintentos</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => {
            const busy = busyId === p.id
            const displayName =
              p.clientName ?? p.agentName ?? p.registeredByName ?? '— Sin nombre'
            const lastError = p.odooAttachmentLastError
              ? truncate(p.odooAttachmentLastError)
              : null
            const retryCount = p.attachmentRetryCount ?? 0
            const atRateLimit = retryCount >= RETRY_RATE_LIMIT_CAP

            return (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="font-medium">{displayName}</span>
                  {p.tripName ? (
                    <span className="block text-xs text-muted-foreground">{p.tripName}</span>
                  ) : null}
                </TableCell>

                <TableCell>
                  {p.amountCents != null ? formatMoney(p.amountCents) : '—'}
                </TableCell>

                <TableCell>
                  {p.odooAttachmentSyncStatus === 'error' ? (
                    <Badge variant="destructive" className="text-xs">
                      Error
                    </Badge>
                  ) : p.odooAttachmentSyncStatus === 'never' ? (
                    <Badge variant="secondary" className="text-xs">
                      Pendiente
                    </Badge>
                  ) : p.odooAttachmentSyncStatus === 'skipped_no_receipt' ? (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Sin comprobante
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell>
                  {p.odooDocumentId ? (
                    <a
                      href={`${ODOO_BASE_URL}/web#id=${p.odooDocumentId}&model=documents.document&view_type=form`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block"
                    >
                      <Badge variant="outline" className="cursor-pointer text-xs hover:bg-muted">
                        Doc {p.odooDocumentId}
                      </Badge>
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell className="text-xs text-muted-foreground">
                  {humanizeAgo(p.verifiedAt)}
                </TableCell>

                <TableCell>
                  {lastError ? (
                    <span
                      className="cursor-help text-xs text-destructive"
                      title={p.odooAttachmentLastError ?? undefined}
                    >
                      {lastError}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell className="text-center">
                  {atRateLimit ? (
                    <span className="text-xs font-medium text-destructive">Rate limit</span>
                  ) : (
                    <span className="text-xs">{retryCount}</span>
                  )}
                </TableCell>

                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || atRateLimit}
                    onClick={() => void handleRetry(p.id)}
                  >
                    {busy ? 'Reintentando…' : 'Reintentar comprobante'}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </>
  )
}
