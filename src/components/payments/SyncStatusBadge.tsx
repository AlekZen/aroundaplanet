'use client'

/**
 * SyncStatusBadge — badge contextual de sync Odoo para pagos verificados.
 *
 * Distingue correctamente entre:
 *   - synced (con enlace Odoo confirmado)
 *   - legacy_linked (enlace retroactivo)
 *   - dismissed (admin descartó el sync)
 *   - error (con CTA a consola)
 *   - pending reciente (<5min desde verifiedAt) → "Encolado"
 *   - pending demorado (≥5min) → "Sync demorado" con CTA
 *   - NUNCA retorna "Sincronizando…"
 *
 * Si status !== 'verified' retorna null (no mostrar badge para pagos no verificados).
 */

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { toEpochMs } from '@/lib/odoo/sync/time'
import type { AnyTimestamp } from '@/lib/odoo/sync/time'
import { cn } from '@/lib/utils'

const FIVE_MIN_MS = 5 * 60 * 1000

export interface SyncStatusBadgeProps {
  payment: {
    odooPaymentId?: number | null
    odooSyncStatus?: 'never_synced' | 'pending' | 'synced' | 'error' | 'orphan' | 'legacy_linked' | 'dismissed' | null
    odooJournalName?: string | null
    odooSyncedAt?: AnyTimestamp
    odooLastError?: string | null
    odooSyncDismissedReason?: string | null
    verifiedAt?: AnyTimestamp
    status?: string
  }
  /** paymentId para links de CTA (opcional; sin él el link no renderiza) */
  paymentId?: string
  /**
   * Href destino del link cuando showConsoleLink=true.
   * Default: sync-console con anchor del pago.
   * Pasar `/admin/verification/{id}` para ir directo al detalle del pago.
   */
  verificationHref?: string
  className?: string
}

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** Deriva el estado efectivo del badge dado el shape del pago. */
function deriveState(payment: SyncStatusBadgeProps['payment']): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  label: string
  className?: string
  tooltip?: string
  showConsoleLink?: boolean
} | null {
  const { odooPaymentId, odooSyncStatus, odooJournalName, odooSyncedAt, odooLastError, odooSyncDismissedReason, verifiedAt, status } = payment

  // Solo mostrar badge para pagos verificados
  if (status !== 'verified') return null

  const effectiveStatus = odooSyncStatus ?? null

  // Estado 1: synced con id
  if (effectiveStatus === 'synced' && odooPaymentId) {
    return {
      variant: 'outline',
      className: 'bg-green-100 text-green-800 border-green-200',
      label: `Synced Odoo #${odooPaymentId} · ${odooJournalName ?? 'Sin journal'}`,
    }
  }

  // Estado 2: legacy_linked
  if (effectiveStatus === 'legacy_linked' && odooPaymentId) {
    return {
      variant: 'secondary',
      label: `Synced Odoo #${odooPaymentId} · legacy`,
    }
  }

  // Estado 3: dismissed
  if (effectiveStatus === 'dismissed') {
    return {
      variant: 'outline',
      className: 'bg-gray-100 text-gray-500 border-gray-200',
      label: 'Sync descartado',
      tooltip: odooSyncDismissedReason ?? undefined,
    }
  }

  // Estado 4: error
  if (effectiveStatus === 'error') {
    return {
      variant: 'destructive',
      label: 'Sync con error · ver consola',
      tooltip: odooLastError ? truncate(odooLastError) : 'Error desconocido',
      showConsoleLink: true,
    }
  }

  // Fallback drift: odooPaymentId existe pero sin odooSyncStatus explícito
  if (odooPaymentId && !effectiveStatus) {
    const syncedMs = toEpochMs(odooSyncedAt)
    if (syncedMs > 0 && Date.now() - syncedMs < FIVE_MIN_MS) {
      // Tratar como synced reciente
      return {
        variant: 'outline',
        className: 'bg-green-100 text-green-800 border-green-200',
        label: `Synced Odoo #${odooPaymentId} · ${odooJournalName ?? 'Sin journal'}`,
      }
    }
    // Sin odooSyncedAt reciente → tratar como pending
  }

  // Estados 5 y 6: pending (o sin status) — distinguir por antigüedad de verifiedAt
  const verifiedMs = toEpochMs(verifiedAt)
  const sinceVerified = verifiedMs > 0 ? Date.now() - verifiedMs : Infinity

  if (sinceVerified < FIVE_MIN_MS) {
    // Estado 5: encolado reciente
    return {
      variant: 'outline',
      className: 'bg-gray-100 text-gray-600 border-gray-200',
      label: 'Encolado · push pendiente',
    }
  }

  // Estado 6: demorado (≥5min sin sync)
  return {
    variant: 'outline',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    label: 'Sync demorado · ver consola',
    showConsoleLink: true,
  }
}

export function SyncStatusBadge({ payment, paymentId, verificationHref, className }: SyncStatusBadgeProps) {
  const state = deriveState(payment)
  if (!state) return null

  const consoleHref =
    verificationHref ??
    (paymentId
      ? `/admin/payments/sync-console#queue?paymentId=${paymentId}`
      : '/admin/payments/sync-console#queue')

  const badge = (
    <Badge
      variant={state.variant}
      title={state.tooltip}
      className={cn('text-[10px]', state.className, className)}
      data-testid="sync-status-badge"
    >
      {state.label}
    </Badge>
  )

  if (state.showConsoleLink) {
    return (
      <Link href={consoleHref} className="inline-flex">
        {badge}
      </Link>
    )
  }

  return badge
}
