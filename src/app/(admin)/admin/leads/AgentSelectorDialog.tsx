'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface Agent {
  uid: string
  agentId: string
  displayName: string
  email: string
}

interface AgentSelectorDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (agentId: string) => void
}

export function AgentSelectorDialog({ isOpen, onOpenChange, onSelect }: AgentSelectorDialogProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchAgents = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/users?roleFilter=agente&statusFilter=active')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Error al cargar agentes')
      }
      const data = await res.json()
      setAgents((data.users ?? []).map((u: Record<string, unknown>) => ({
        uid: u.uid as string,
        agentId: (u.agentId as string) ?? (u.uid as string),
        displayName: u.displayName as string,
        email: u.email as string,
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchAgents()
      setSearch('')
    }
  }, [isOpen, fetchAgents])

  const filtered = search
    ? agents.filter((a) =>
        a.displayName.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase())
      )
    : agents

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Seleccionar Agente</DialogTitle>
          <DialogDescription>Elige un agente activo para asignar este lead</DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar agente"
        />

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {isLoading && (
            <div className="space-y-2" role="status" aria-label="Cargando agentes">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {error && (
            <div role="alert" className="p-3 text-center text-sm text-destructive">
              {error}
              <Button variant="link" size="sm" onClick={fetchAgents}>Reintentar</Button>
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No se encontraron agentes
            </p>
          )}

          {!isLoading && !error && filtered.map((agent) => (
            <button
              key={agent.uid}
              type="button"
              className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
              onClick={() => onSelect(agent.agentId)}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted font-heading text-sm font-semibold">
                {agent.displayName?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{agent.displayName}</p>
                <p className="text-xs text-muted-foreground">{agent.email}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
