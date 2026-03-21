'use client'

import { useCallback, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Search, RefreshCw, ArrowLeft, Users } from 'lucide-react'
import type { OdooAgentResponse } from '@/app/api/odoo/agents/route'
import { AgentClientList } from '@/app/(agent)/agent/clients/AgentClientList'

interface PanelState {
  agents: OdooAgentResponse[]
  isLoading: boolean
  error: string | null
}

export function SuperAdminClientsPanel() {
  const [state, setState] = useState<PanelState>({
    agents: [], isLoading: true, error: null,
  })
  const [search, setSearch] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<OdooAgentResponse | null>(null)

  const fetchAgents = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }))
    try {
      const res = await fetch('/api/odoo/agents')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Error al cargar agentes')
      }
      const agents: OdooAgentResponse[] = await res.json()
      setState({ agents, isLoading: false, error: null })
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error desconocido',
      }))
    }
  }, [])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  // If an agent is selected, show their clients
  if (selectedAgent) {
    // We need the agentId (UID) for the API call, which comes from linkedUserId
    // If the agent is not linked to a platform user, we can't show clients via the API
    // So we show the agent's odooTeamId-based clients
    const agentIdentifier = selectedAgent.linkedUserId ?? `odoo-team-${selectedAgent.odooTeamId}`

    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedAgent(null)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a agentes
        </Button>
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{selectedAgent.name}</p>
              <p className="text-xs text-muted-foreground">
                Team ID: {selectedAgent.odooTeamId} &middot; {selectedAgent.orderCount} ordenes
                {selectedAgent.linkedUserId && (
                  <> &middot; <Badge variant="outline" className="text-xs">Vinculado</Badge></>
                )}
              </p>
            </div>
          </div>
        </div>
        <AgentClientList
          agentId={agentIdentifier}
          title={`Clientes de ${selectedAgent.name}`}
          hideHeader
        />
      </div>
    )
  }

  const filtered = search.trim()
    ? state.agents.filter((a) =>
        a.name.toLowerCase().includes(search.toLowerCase())
      )
    : state.agents

  // Only show agents with orders
  const agentsWithOrders = filtered.filter((a) => a.orderCount > 0)

  const totalOrders = state.agents.reduce((sum, a) => sum + a.orderCount, 0)
  const linkedCount = state.agents.filter((a) => a.linkedUserId && a.orderCount > 0).length
  const agentsWithOrdersTotal = state.agents.filter((a) => a.orderCount > 0).length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Agentes con ordenes</p>
            <p className="text-2xl font-bold">{agentsWithOrdersTotal}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total ordenes</p>
            <p className="text-2xl font-bold text-blue-700">{totalOrders.toLocaleString('es-MX')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Vinculados a plataforma</p>
            <p className="text-2xl font-bold text-purple-700">{linkedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar agente por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAgents}
          disabled={state.isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${state.isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Error */}
      {state.error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{state.error}</p>
          </CardContent>
        </Card>
      )}

      {/* Agent list */}
      {state.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : agentsWithOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
            {search ? 'Sin resultados' : 'Sin agentes con ordenes'}
          </h2>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead className="text-right">Ordenes</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentsWithOrders.map((agent) => (
                <TableRow
                  key={agent.odooTeamId}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedAgent(agent)}
                >
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="font-medium">{agent.orderCount.toLocaleString('es-MX')}</span>
                  </TableCell>
                  <TableCell>
                    {agent.linkedUserId ? (
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        Vinculado
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No vinculado</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      Ver clientes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
