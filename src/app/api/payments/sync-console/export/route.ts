import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { csvRow } from '@/lib/csv/escape'

const EXPORT_SECTION = ['conflicts', 'queue', 'alerts'] as const
const EXPORT_STATUS = ['open', 'resolved', 'all'] as const

const exportQuerySchema = z.object({
  section: z.enum(EXPORT_SECTION),
  status: z.enum(EXPORT_STATUS).default('open'),
})

const CSV_HEADERS = [
  'paymentId',
  'firestoreId',
  'odooPaymentId',
  'clientName',
  'amount (MXN)',
  'paymentDate',
  'status',
  'odooState',
  'odooSyncStatus',
  'lastSyncAt',
  'lastError',
  'detectedAt',
  'resolvedAt',
  'resolvedBy',
]

const MAX_ROWS = 1000

function formatDate(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  // Firestore Timestamp shape: { seconds: number, nanoseconds: number }
  if (typeof value === 'object' && value !== null) {
    const v = value as Record<string, unknown>
    if (typeof v.seconds === 'number') {
      return new Date(v.seconds * 1000).toISOString()
    }
    if (typeof v.toDate === 'function') {
      return (v.toDate as () => Date)().toISOString()
    }
  }
  return String(value)
}

function centsToMxn(value: unknown): string {
  if (typeof value !== 'number') return ''
  return (value / 100).toFixed(2)
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * GET /api/payments/sync-console/export
 * Exporta datos de sync-console en CSV.
 * Requiere permiso payments:verify (admin/superadmin).
 * Query params: section (conflicts|queue|alerts), status (open|resolved|all).
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission('payments:verify')

    const url = new URL(request.url)
    const rawQuery = { section: url.searchParams.get('section'), status: url.searchParams.get('status') ?? 'open' }

    const parsed = exportQuerySchema.safeParse(rawQuery)
    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Parámetros inválidos', retryable: false },
        { status: 400 },
      )
    }

    const { section, status } = parsed.data
    const rows: unknown[][] = []

    if (section === 'conflicts') {
      let query = adminDb.collection('paymentConflicts').orderBy('detectedAt', 'desc').limit(MAX_ROWS)

      if (status === 'open') {
        query = adminDb
          .collection('paymentConflicts')
          .where('resolvedAt', '==', null)
          .orderBy('detectedAt', 'desc')
          .limit(MAX_ROWS)
      } else if (status === 'resolved') {
        // Firestore Admin SDK: != null requires composite index — usamos where con orderBy
        query = adminDb
          .collection('paymentConflicts')
          .where('resolvedAt', '!=', null)
          .orderBy('resolvedAt', 'desc')
          .limit(MAX_ROWS)
      }

      const snap = await query.get()

      // Enriquecer con datos del pago para clientName/amount
      const paymentIds = [...new Set(snap.docs.map((d) => d.data().paymentId as string))]
      const paymentMap = new Map<string, Record<string, unknown>>()

      if (paymentIds.length > 0) {
        // Batch por 30 (límite 'in' de Firestore)
        const chunks: string[][] = []
        for (let i = 0; i < paymentIds.length; i += 30) {
          chunks.push(paymentIds.slice(i, i + 30))
        }
        for (const chunk of chunks) {
          const paySnap = await adminDb.collection('payments').where('__name__', 'in', chunk).get()
          for (const doc of paySnap.docs) {
            paymentMap.set(doc.id, doc.data())
          }
        }
      }

      for (const doc of snap.docs) {
        const d = doc.data()
        const pay = paymentMap.get(d.paymentId as string) ?? {}
        rows.push([
          d.paymentId ?? '',
          doc.id,
          pay.odooPaymentId ?? '',
          pay.clientName ?? '',
          centsToMxn(pay.amount),
          formatDate(pay.paymentDate),
          pay.status ?? '',
          pay.odooState ?? '',
          pay.odooSyncStatus ?? '',
          formatDate(pay.odooSyncedAt),
          pay.lastError ?? '',
          formatDate(d.detectedAt),
          formatDate(d.resolvedAt),
          d.resolvedBy ?? '',
        ])
      }
    } else if (section === 'queue') {
      let query = adminDb.collection('payments').orderBy('verifiedAt', 'desc').limit(MAX_ROWS)

      if (status === 'open') {
        query = adminDb
          .collection('payments')
          .where('odooSyncStatus', 'in', ['pending', 'error'])
          .orderBy('verifiedAt', 'desc')
          .limit(MAX_ROWS)
      } else if (status === 'resolved') {
        query = adminDb
          .collection('payments')
          .where('odooSyncStatus', '==', 'synced')
          .orderBy('verifiedAt', 'desc')
          .limit(MAX_ROWS)
      }

      const snap = await query.get()

      for (const doc of snap.docs) {
        const d = doc.data()
        rows.push([
          doc.id,
          doc.id,
          d.odooPaymentId ?? '',
          d.clientName ?? '',
          centsToMxn(d.amount),
          formatDate(d.paymentDate),
          d.status ?? '',
          d.odooState ?? '',
          d.odooSyncStatus ?? '',
          formatDate(d.odooSyncedAt),
          d.lastError ?? '',
          formatDate(d.verifiedAt),
          '',
          '',
        ])
      }
    } else {
      // alerts
      let query = adminDb.collection('paymentAlerts').orderBy('detectedAt', 'desc').limit(MAX_ROWS)

      if (status === 'open') {
        query = adminDb
          .collection('paymentAlerts')
          .where('status', '==', 'open')
          .orderBy('detectedAt', 'desc')
          .limit(MAX_ROWS)
      } else if (status === 'resolved') {
        query = adminDb
          .collection('paymentAlerts')
          .where('status', 'in', ['dismissed', 'resolved'])
          .orderBy('detectedAt', 'desc')
          .limit(MAX_ROWS)
      }

      const snap = await query.get()

      for (const doc of snap.docs) {
        const d = doc.data()
        rows.push([
          d.paymentId ?? '',
          doc.id,
          d.odooPaymentId ?? '',
          '',
          '',
          '',
          d.firestoreStatus ?? '',
          d.odooState ?? '',
          '',
          '',
          '',
          formatDate(d.detectedAt),
          formatDate(d.resolvedAt),
          d.resolvedBy ?? '',
        ])
      }
    }

    const csvLines: string[] = [csvRow(CSV_HEADERS)]
    for (const row of rows) {
      csvLines.push(csvRow(row))
    }
    const csvContent = csvLines.join('\r\n')

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sync-console-${section}-${todayString()}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
