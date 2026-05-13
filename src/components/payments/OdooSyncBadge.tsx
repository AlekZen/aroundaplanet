'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { OdooSyncStatus } from '@/schemas/paymentSchema'

interface Props {
  status: OdooSyncStatus | null | undefined
  odooPaymentId?: number | null
  odooJournalName?: string | null
  odooLastError?: string | null
  className?: string
}

const STATUS_STYLES: Record<string, string> = {
  synced: 'bg-green-100 text-green-800 border-green-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  orphan: 'bg-orange-100 text-orange-800 border-orange-200',
  legacy_linked: 'bg-blue-100 text-blue-800 border-blue-200',
}

function truncate(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function OdooSyncBadge({ status, odooPaymentId, odooJournalName, odooLastError, className }: Props) {
  // Default: si status === null/undefined → "Sincronizando…" (verificado recién, push en vuelo)
  // o vacío si nunca verificado
  const effective: string = status ?? 'pending'

  let label: string
  let tooltip: string | undefined

  switch (effective) {
    case 'synced':
      label = `Synced Odoo #${odooPaymentId ?? '?'}${odooJournalName ? ` · ${odooJournalName}` : ''}`
      break
    case 'pending':
      label = 'Sincronizando…'
      break
    case 'error':
      label = 'Sync error'
      tooltip = odooLastError ? truncate(odooLastError) : 'Error desconocido'
      break
    case 'orphan':
      label = `Huérfano Odoo #${odooPaymentId ?? '?'}`
      tooltip = 'Payment creado pero external_id no enlazó. Reintentar.'
      break
    case 'legacy_linked':
      label = `Legacy Odoo #${odooPaymentId ?? '?'}`
      tooltip = 'Pago pre-existente enlazado retroactivamente.'
      break
    case 'never_synced':
      return null
    default:
      label = String(effective)
  }

  return (
    <Badge
      title={tooltip}
      variant="outline"
      className={cn(STATUS_STYLES[effective] ?? '', 'text-[10px]', className)}
      data-testid={`odoo-sync-badge-${effective}`}
    >
      {label}
    </Badge>
  )
}
