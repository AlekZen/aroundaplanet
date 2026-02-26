'use client'

import { useState, useEffect, useCallback } from 'react'
import type { UserRole } from '@/types/user'
import { VALID_ROLES, ROLE_LABELS } from '@/config/roles'
import { RoleBadge } from '@/components/custom/RoleBadge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Roles that can be toggled (all except cliente which is always on) */
const ASSIGNABLE_ROLES = VALID_ROLES.filter((r) => r !== 'cliente') as UserRole[]

export interface RoleAssignmentSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  user: {
    uid: string
    displayName: string
    roles: UserRole[]
    agentId?: string
  } | null
  onSave: (uid: string, roles: UserRole[], agentId?: string) => Promise<void>
}

export function RoleAssignmentSheet({
  isOpen,
  onOpenChange,
  user,
  onSave,
}: RoleAssignmentSheetProps) {
  const [selectedRoles, setSelectedRoles] = useState<Set<UserRole>>(new Set(['cliente']))
  const [agentId, setAgentId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Sync local state when user changes or sheet opens/reopens
  useEffect(() => {
    if (user && isOpen) {
      const roles = new Set<UserRole>(user.roles)
      roles.add('cliente') // Always include cliente
      setSelectedRoles(roles)
      setAgentId(user.agentId ?? '')
      setSaveError(null)
    }
  }, [user, isOpen])

  const handleToggleRole = useCallback((role: UserRole) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev)
      if (next.has(role)) {
        next.delete(role)
      } else {
        next.add(role)
      }
      return next
    })
  }, [])

  const handleAgentIdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAgentId(e.target.value)
  }, [])

  const isAgenteSelected = selectedRoles.has('agente')
  const isAgentIdRequired = isAgenteSelected && agentId.trim() === ''

  const handleSave = useCallback(async () => {
    if (!user) return
    if (isAgentIdRequired) return

    setIsSaving(true)
    setSaveError(null)
    try {
      const roles = Array.from(selectedRoles) as UserRole[]
      await onSave(user.uid, roles, isAgenteSelected ? agentId.trim() : undefined)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar roles')
    } finally {
      setIsSaving(false)
    }
  }, [user, selectedRoles, agentId, isAgenteSelected, isAgentIdRequired, onSave])

  if (!user) return null

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" aria-describedby="role-assignment-description">
        <SheetHeader>
          <SheetTitle>Asignar Roles</SheetTitle>
          <SheetDescription id="role-assignment-description">
            Modifica los roles de {user.displayName}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 py-2">
          {/* Current roles display */}
          <div>
            <Label className="mb-2 text-sm font-medium">Roles actuales</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {user.roles.map((role) => (
                <RoleBadge key={role} role={role} />
              ))}
            </div>
          </div>

          {/* Role checkboxes */}
          <fieldset>
            <legend className="text-sm font-medium mb-3">Seleccionar roles</legend>
            <div className="flex flex-col gap-3">
              {/* Cliente — always checked, disabled */}
              <label className="flex items-center gap-2 cursor-not-allowed opacity-70">
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  aria-label={ROLE_LABELS.cliente}
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                />
                <span className="text-sm">{ROLE_LABELS.cliente}</span>
                <span className="text-xs text-muted-foreground">(base)</span>
              </label>

              {/* Assignable roles */}
              {ASSIGNABLE_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRoles.has(role)}
                    onChange={() => handleToggleRole(role)}
                    aria-label={ROLE_LABELS[role]}
                    className="h-4 w-4 rounded border-gray-300 accent-primary"
                  />
                  <span className="text-sm">{ROLE_LABELS[role]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Agent ID input — only when Agente is selected */}
          {isAgenteSelected && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-id-input">
                ID de Agente <span className="text-destructive">*</span>
              </Label>
              <Input
                id="agent-id-input"
                value={agentId}
                onChange={handleAgentIdChange}
                placeholder="Ej: AGT-001"
                aria-required="true"
                aria-invalid={isAgentIdRequired}
              />
              {isAgentIdRequired && (
                <p className="text-xs text-destructive">
                  El ID de agente es requerido cuando el rol Agente esta asignado
                </p>
              )}
            </div>
          )}
        </div>

        {saveError && (
          <p role="alert" className="px-4 text-sm text-destructive">{saveError}</p>
        )}

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isAgentIdRequired}
          >
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
