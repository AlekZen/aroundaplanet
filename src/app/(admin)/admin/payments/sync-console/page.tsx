import { adminDb } from '@/lib/firebase/admin'
import { SyncConsoleDashboard } from './SyncConsoleDashboard'
import type { SyncCursorSummary } from '@/schemas/syncCursorSchema'
import type { PaymentAlertType } from '@/schemas/paymentAlertSchema'
import { PAYMENT_ALERT_TYPES } from '@/schemas/paymentAlertSchema'

export const metadata = { title: 'Consola de Sync | AroundaPlanet' }

export const revalidate = 0 // No cache — datos operativos

export interface InitialCounts {
  conflicts: number
  pushQueue: number
  alerts: number
  alertsByType: Partial<Record<PaymentAlertType, number>>
  attachmentQueue: number
}

export interface CursorSummary {
  lastRunAt: string | null
  summary: SyncCursorSummary | null
  lastError: string | null
  successRate24h: number | null
}

export default async function SyncConsolePage() {
  // Count conflictos pendientes
  const conflictsSnap = await adminDb
    .collection('paymentConflicts')
    .where('resolvedAt', '==', null)
    .count()
    .get()
  const conflictsCount = conflictsSnap.data().count

  // Count cola de push: verified + sin odooPaymentId (alineado con PushQueueTable).
  // Puede over-contar dismissed (raro) — aceptable para KPI de cabecera.
  const pushQueueSnap = await adminDb
    .collection('payments')
    .where('status', '==', 'verified')
    .where('odooPaymentId', '==', null)
    .count()
    .get()
  const pushQueueCount = pushQueueSnap.data().count

  // Count alertas abiertas + breakdown por tipo
  const alertsByType: Partial<Record<PaymentAlertType, number>> = {}
  let alertsTotal = 0
  for (const type of PAYMENT_ALERT_TYPES) {
    const snap = await adminDb
      .collection('paymentAlerts')
      .where('status', '==', 'open')
      .where('type', '==', type)
      .count()
      .get()
    const cnt = snap.data().count
    if (cnt > 0) alertsByType[type] = cnt
    alertsTotal += cnt
  }

  // Cursor del pull
  const cursorDoc = await adminDb.doc('syncCursors/odooPayments').get()
  const cursorData = cursorDoc.data()

  let lastRunAt: string | null = null
  if (cursorData?.lastRunAt) {
    const raw = cursorData.lastRunAt
    if (typeof raw.toDate === 'function') {
      lastRunAt = (raw.toDate() as Date).toISOString()
    } else {
      lastRunAt = String(raw)
    }
  }

  const summary: SyncCursorSummary | null = cursorData?.lastRunSummary ?? null
  const lastError: string | null = cursorData?.lastError ?? null

  // Count comprobantes con error de attachment (odooPaymentId != null + status error).
  // Se hace una sola query por 'error' ya que 'never' es el estado inicial de pagos sin
  // comprobante registrado aún — no es un error visible operativamente hasta que falle.
  // Para el KPI de cabecera esto es suficiente; AttachmentQueueTable hace filtrado completo client-side.
  const attachmentQueueSnap = await adminDb
    .collection('payments')
    .where('status', '==', 'verified')
    .where('odooAttachmentSyncStatus', '==', 'error')
    .count()
    .get()
  const attachmentQueueCount = attachmentQueueSnap.data().count

  // Tasa de éxito: si hay summary con datos, calcular
  let successRate24h: number | null = null
  if (summary && typeof summary.fetched === 'number' && summary.fetched > 0) {
    const matched = summary.matched ?? 0
    const updated = summary.updated ?? 0
    successRate24h = Math.round(((matched + updated) / summary.fetched) * 100)
  }

  const initialCounts: InitialCounts = {
    conflicts: conflictsCount,
    pushQueue: pushQueueCount,
    alerts: alertsTotal,
    alertsByType,
    attachmentQueue: attachmentQueueCount,
  }

  const cursorSummary: CursorSummary = {
    lastRunAt,
    summary,
    lastError,
    successRate24h,
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Consola de Sync</h1>
      <SyncConsoleDashboard initialCounts={initialCounts} cursorSummary={cursorSummary} />
    </div>
  )
}
