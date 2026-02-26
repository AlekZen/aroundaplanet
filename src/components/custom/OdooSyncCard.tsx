'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'

interface OdooSyncResult {
  total: number
  created: number
  updated: number
  errors: number
  syncedAt: string
  isStale: boolean
}

interface OdooSyncCardProps {
  onSync: () => Promise<OdooSyncResult>
  lastSync?: { syncedAt: string; total: number; isStale: boolean } | null
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'hace un momento'
  if (diffMinutes < 60) return `hace ${diffMinutes} minuto${diffMinutes === 1 ? '' : 's'}`
  if (diffHours < 24) return `hace ${diffHours} hora${diffHours === 1 ? '' : 's'}`
  return `hace ${diffDays} dia${diffDays === 1 ? '' : 's'}`
}

export type { OdooSyncResult, OdooSyncCardProps }

export function OdooSyncCard({ onSync, lastSync }: OdooSyncCardProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<OdooSyncResult | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  async function handleSync() {
    setIsSyncing(true)
    setSyncError(null)
    setSyncResult(null)
    try {
      const result = await onSync()
      setSyncResult(result)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido al sincronizar'
      setSyncError(message)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Card aria-label="Sincronizacion Odoo">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Sincronizacion Odoo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Last sync info */}
        <div className="text-sm text-muted-foreground">
          {lastSync ? (
            <div className="space-y-1">
              <p>Ultima sincronizacion: {formatRelativeTime(lastSync.syncedAt)}</p>
              <p>{lastSync.total} usuarios sincronizados</p>
              {lastSync.isStale && (
                <Badge variant="secondary" className="text-yellow-700 bg-yellow-100">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Datos desactualizados
                </Badge>
              )}
            </div>
          ) : (
            <p>Nunca sincronizado</p>
          )}
        </div>

        {/* Sync result summary */}
        {syncResult && (
          <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-1" aria-label="Resultado de sincronizacion">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Sincronizacion completada
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <p>Total: {syncResult.total}</p>
              <p>Creados: {syncResult.created}</p>
              <p>Actualizados: {syncResult.updated}</p>
              {syncResult.errors > 0 && (
                <p className="text-destructive">Errores: {syncResult.errors}</p>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {syncError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {syncError}
            </div>
          </div>
        )}

        {/* Sync button */}
        <Button onClick={handleSync} disabled={isSyncing} className="w-full">
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sincronizando...' : 'Sincronizar desde Odoo'}
        </Button>
      </CardContent>
    </Card>
  )
}
