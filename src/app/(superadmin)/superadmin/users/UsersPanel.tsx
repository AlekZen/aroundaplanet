'use client'

import { useCallback, useState } from 'react'
import { UserTable } from '@/components/custom/UserTable'
import { RoleAssignmentSheet } from '@/components/custom/RoleAssignmentSheet'
import { UserDeactivateDialog } from '@/components/custom/UserDeactivateDialog'
import { OdooSyncCard } from '@/components/custom/OdooSyncCard'
import type { UserProfile, UserRole, OdooSyncResult } from '@/types/user'

export function UsersPanel() {
  const [editUser, setEditUser] = useState<UserProfile | null>(null)
  const [deactivateUser, setDeactivateUser] = useState<UserProfile | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSaveRoles = useCallback(async (uid: string, roles: UserRole[], agentId?: string) => {
    const res = await fetch('/api/auth/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, roles, agentId }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message ?? 'Error al actualizar roles')
    }
    setEditUser(null)
    setRefreshKey((k) => k + 1)
  }, [])

  const handleDeactivate = useCallback(async (uid: string, isActive: boolean, reason?: string) => {
    const res = await fetch(`/api/users/${uid}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive, reason }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message ?? 'Error al cambiar estado')
    }
    setDeactivateUser(null)
    setRefreshKey((k) => k + 1)
  }, [])

  const handleSync = useCallback(async (): Promise<OdooSyncResult> => {
    const res = await fetch('/api/odoo/sync-users', { method: 'POST' })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message ?? 'Error en sincronizacion')
    }
    const result: OdooSyncResult = await res.json()
    setRefreshKey((k) => k + 1)
    return result
  }, [])

  return (
    <div className="space-y-6">
      <OdooSyncCard onSync={handleSync} />

      <UserTable
        key={refreshKey}
        onEditRoles={setEditUser}
        onDeactivate={setDeactivateUser}
      />

      <RoleAssignmentSheet
        isOpen={!!editUser}
        onOpenChange={(open) => { if (!open) setEditUser(null) }}
        user={editUser ? {
          uid: editUser.uid,
          displayName: editUser.displayName,
          roles: editUser.roles,
          agentId: editUser.agentId,
        } : null}
        onSave={handleSaveRoles}
      />

      <UserDeactivateDialog
        isOpen={!!deactivateUser}
        onOpenChange={(open) => { if (!open) setDeactivateUser(null) }}
        user={deactivateUser ? {
          uid: deactivateUser.uid,
          displayName: deactivateUser.displayName,
          isActive: deactivateUser.isActive,
        } : null}
        onConfirm={handleDeactivate}
      />
    </div>
  )
}
