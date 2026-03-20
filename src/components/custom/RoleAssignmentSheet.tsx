'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Roles that can be toggled (all except cliente which is always on) */
const ASSIGNABLE_ROLES = VALID_ROLES.filter((r) => r !== 'cliente') as UserRole[]

interface OdooAgentOption {
  odooTeamId: number
  name: string
  orderCount: number
}

export interface RoleAssignmentSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  user: {
    uid: string
    displayName: string
    roles: UserRole[]
    agentId?: string
    odooTeamId?: number
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

  // Odoo agent selector state
  const [odooAgents, setOdooAgents] = useState<OdooAgentOption[]>([])
  const [isLoadingAgents, setIsLoadingAgents] = useState(false)
  const [selectedOdooAgent, setSelectedOdooAgent] = useState<OdooAgentOption | null>(null)
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const agentsFetchedRef = useRef(false)

  // Sync local state when user changes or sheet opens/reopens
  useEffect(() => {
    if (user && isOpen) {
      const roles = new Set<UserRole>(user.roles)
      roles.add('cliente') // Always include cliente
      setSelectedRoles(roles)
      setAgentId(user.agentId ?? '')
      setSaveError(null)
      setSelectedOdooAgent(null)
    }
  }, [user, isOpen])

  // Fetch Odoo agents when Agente role is selected (once per sheet open)
  useEffect(() => {
    if (!isOpen) {
      agentsFetchedRef.current = false
      return
    }
  }, [isOpen])

  const fetchOdooAgents = useCallback(async () => {
    if (agentsFetchedRef.current || isLoadingAgents) return
    agentsFetchedRef.current = true
    setIsLoadingAgents(true)
    try {
      const res = await fetch('/api/odoo/agents')
      if (res.ok) {
        const data = await res.json()
        setOdooAgents(data.map((a: OdooAgentOption) => ({
          odooTeamId: a.odooTeamId,
          name: a.name,
          orderCount: a.orderCount,
        })))

        // Pre-select if user already has odooTeamId
        if (user?.odooTeamId) {
          const match = data.find(
            (a: OdooAgentOption) => a.odooTeamId === user.odooTeamId
          )
          if (match) {
            setSelectedOdooAgent(match)
          }
        }
      }
    } catch {
      // Non-critical — agents list is optional
    } finally {
      setIsLoadingAgents(false)
    }
  }, [isLoadingAgents, user?.odooTeamId])

  const handleToggleRole = useCallback((role: UserRole) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev)
      if (next.has(role)) {
        next.delete(role)
        if (role === 'agente') {
          setSelectedOdooAgent(null)
        }
      } else {
        next.add(role)
        // Auto-fill agentId with user UID when Agente is toggled on
        if (role === 'agente' && !agentId && user) {
          setAgentId(user.uid)
        }
        // Fetch Odoo agents when Agente is toggled on
        if (role === 'agente') {
          fetchOdooAgents()
        }
      }
      return next
    })
  }, [agentId, user, fetchOdooAgents])

  // Also fetch if sheet opens and agente is already selected
  useEffect(() => {
    if (isOpen && selectedRoles.has('agente') && odooAgents.length === 0) {
      fetchOdooAgents()
    }
  }, [isOpen, selectedRoles, odooAgents.length, fetchOdooAgents])

  const isAgenteSelected = selectedRoles.has('agente')

  const handleSelectOdooAgent = useCallback((agent: OdooAgentOption | null) => {
    setSelectedOdooAgent(agent)
    setComboboxOpen(false)
    // agentId stays as user.uid — the Odoo link is informational for now
  }, [])

  const handleSave = useCallback(async () => {
    if (!user) return
    if (isAgenteSelected && !agentId.trim()) return

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
  }, [user, selectedRoles, agentId, isAgenteSelected, onSave])

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

          {/* Agent ID + Odoo agent selector */}
          {isAgenteSelected && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>ID de Agente</Label>
                <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                  <p className="font-mono text-xs text-muted-foreground">{agentId || user.uid}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Se asigna automaticamente al usuario
                  </p>
                </div>
              </div>

              {/* Odoo agent link */}
              <div className="flex flex-col gap-1.5">
                <Label>Vincular con agente Odoo <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      aria-label="Seleccionar agente Odoo"
                      className="justify-between font-normal"
                      disabled={isLoadingAgents}
                    >
                      {isLoadingAgents ? (
                        'Cargando agentes...'
                      ) : selectedOdooAgent ? (
                        <span className="truncate">
                          {selectedOdooAgent.name}
                          {selectedOdooAgent.orderCount > 0 && (
                            <span className="text-muted-foreground"> ({selectedOdooAgent.orderCount} ordenes)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sin vinculo Odoo</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar agente Odoo..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron agentes</CommandEmpty>
                        <CommandGroup>
                          {/* Option to unlink */}
                          <CommandItem
                            value="__none__"
                            onSelect={() => handleSelectOdooAgent(null)}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                !selectedOdooAgent ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <span className="text-muted-foreground">Sin vinculo Odoo</span>
                          </CommandItem>
                          {odooAgents.map((agent) => (
                            <CommandItem
                              key={agent.odooTeamId}
                              value={agent.name}
                              onSelect={() => handleSelectOdooAgent(agent)}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedOdooAgent?.odooTeamId === agent.odooTeamId
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="text-sm">{agent.name}</span>
                                {agent.orderCount > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {agent.orderCount} ordenes
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
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
            disabled={isSaving}
          >
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
