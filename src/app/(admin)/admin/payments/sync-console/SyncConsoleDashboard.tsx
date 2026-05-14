'use client'

import Link from 'next/link'
import { KPICard } from '@/components/custom/KPICard'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle } from 'lucide-react'
import { ConflictsTable } from './ConflictsTable'
import { PushQueueTable } from './PushQueueTable'
import { AlertsTable } from './AlertsTable'
import type { InitialCounts, CursorSummary } from './page'
import type { PaymentAlertType } from '@/schemas/paymentAlertSchema'

const ALERT_TYPE_LABELS: Record<PaymentAlertType, string> = {
  odoo_canceled: 'Cancelado',
  attachment_failed: 'Adjunto fallido',
  orphan_payment: 'Pago huérfano',
  unknown_method: 'Método desconocido',
}

const ALERT_TYPE_COLORS: Record<PaymentAlertType, string> = {
  odoo_canceled: 'bg-red-100 text-red-800',
  attachment_failed: 'bg-orange-100 text-orange-800',
  orphan_payment: 'bg-yellow-100 text-yellow-800',
  unknown_method: 'bg-gray-100 text-gray-800',
}

function humanizeDate(iso: string | null): string {
  if (!iso) return 'Nunca'
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'hace menos de 1 min'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `hace ${diffHrs} h`
  return d.toLocaleDateString('es-MX')
}

interface Props {
  initialCounts: InitialCounts
  cursorSummary: CursorSummary
}

export function SyncConsoleDashboard({ initialCounts, cursorSummary }: Props) {
  const { conflicts, pushQueue, alerts, alertsByType } = initialCounts
  const { lastRunAt, summary, lastError, successRate24h } = cursorSummary

  function handleExport(section: 'conflicts' | 'queue' | 'alerts') {
    const url = `/api/payments/sync-console/export?section=${section}&status=open`
    window.location.href = url
  }

  const summaryText = summary
    ? `↓${summary.fetched ?? 0} coincididos:${summary.matched ?? 0} actualizados:${summary.updated ?? 0} conflictos:${summary.conflicts ?? 0} alertas:${summary.alerts ?? 0}`
    : null

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* Conflictos pendientes */}
        <Link href="#conflicts" className="block">
          <KPICard
            title="Conflictos pendientes"
            value={conflicts}
            variant="compact"
            className="hover:border-primary/40 transition-colors cursor-pointer"
          />
        </Link>

        {/* Cola de push */}
        <Link href="#queue" className="block">
          <KPICard
            title="Cola de push"
            value={pushQueue}
            variant="compact"
            className="hover:border-primary/40 transition-colors cursor-pointer"
          />
        </Link>

        {/* Alertas activas — Card personalizado por sub-badges */}
        <Link href="#alerts" className="block">
          <Card className="p-4 hover:border-primary/40 transition-colors cursor-pointer">
            <CardContent className="p-0">
              <p className="text-sm text-muted-foreground">Alertas activas</p>
              <p className="font-mono font-medium text-2xl text-foreground">{alerts}</p>
              {Object.keys(alertsByType).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {(Object.entries(alertsByType) as [PaymentAlertType, number][]).map(([type, count]) => (
                    <span
                      key={type}
                      className={`text-xs rounded px-1.5 py-0.5 font-medium ${ALERT_TYPE_COLORS[type]}`}
                    >
                      {ALERT_TYPE_LABELS[type]}: {count}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Último pull — Card personalizado con estado degradado */}
        <Card className="p-4 sm:col-span-1">
          <CardContent className="p-0">
            <div className="flex items-center gap-1">
              <p className="text-sm text-muted-foreground">Último pull</p>
              {lastError && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Badge variant="destructive" className="text-xs px-1.5 py-0 cursor-help">
                          <AlertTriangle className="h-3 w-3 mr-0.5" />
                          Error
                        </Badge>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs">{lastError}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="font-mono font-medium text-lg text-foreground">{humanizeDate(lastRunAt)}</p>
            {summaryText && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate" title={summaryText}>
                {summaryText}
              </p>
            )}
            {lastError && (
              <p className="text-xs text-destructive mt-1 truncate" title={lastError}>
                {lastError.slice(0, 120)}{lastError.length > 120 ? '…' : ''}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tasa de éxito 24h */}
        <KPICard
          title="Éxito 24h"
          value={successRate24h !== null ? `${successRate24h}%` : '—'}
          variant="compact"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="conflicts">
        <TabsList>
          <TabsTrigger value="conflicts" id="conflicts">
            Conflictos {conflicts > 0 && <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">{conflicts}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="queue" id="queue">
            Cola de push {pushQueue > 0 && <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{pushQueue}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="alerts" id="alerts">
            Alertas {alerts > 0 && <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{alerts}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conflicts" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => handleExport('conflicts')}>
              Exportar CSV
            </Button>
          </div>
          <ConflictsTable />
        </TabsContent>

        <TabsContent value="queue" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => handleExport('queue')}>
              Exportar CSV
            </Button>
          </div>
          <PushQueueTable />
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => handleExport('alerts')}>
              Exportar CSV
            </Button>
          </div>
          <AlertsTable />
        </TabsContent>
      </Tabs>
    </div>
  )
}
