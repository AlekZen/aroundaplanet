'use client'

import { useCallback } from 'react'
import { OdooSyncCard } from '@/components/custom/OdooSyncCard'
import type { OdooSyncResult } from '@/components/custom/OdooSyncCard'

export function OdooSyncDashboard() {
  const handleSyncUsers = useCallback(async (): Promise<OdooSyncResult> => {
    const res = await fetch('/api/odoo/sync-users', { method: 'POST' })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message ?? 'Error en sincronizacion de usuarios')
    }
    return res.json()
  }, [])

  const handleSyncTrips = useCallback(async (): Promise<OdooSyncResult> => {
    const res = await fetch('/api/odoo/sync-trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'full', nameFilter: '2026', minPrice: 5000 }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message ?? 'Error en sincronizacion de viajes')
    }
    const data = await res.json()
    // Map TripSyncResult to OdooSyncResult for OdooSyncCard compatibility
    return {
      total: data.total,
      created: data.created,
      updated: data.updated,
      errors: data.errors,
      syncedAt: data.syncedAt,
      isStale: false,
    }
  }, [])

  const handleSyncAgents = useCallback(async (): Promise<OdooSyncResult> => {
    const res = await fetch('/api/odoo/sync-agents', { method: 'POST' })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message ?? 'Error en sincronizacion de agentes')
    }
    return res.json()
  }, [])

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div>
        <h2 className="mb-3 text-lg font-medium text-foreground">Usuarios</h2>
        <OdooSyncCard onSync={handleSyncUsers} />
      </div>
      <div>
        <h2 className="mb-3 text-lg font-medium text-foreground">Viajes (2026)</h2>
        <OdooSyncCard onSync={handleSyncTrips} />
      </div>
      <div>
        <h2 className="mb-3 text-lg font-medium text-foreground">Agentes</h2>
        <OdooSyncCard onSync={handleSyncAgents} />
      </div>
    </div>
  )
}
