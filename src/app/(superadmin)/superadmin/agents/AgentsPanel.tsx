'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, ExternalLink, Search } from 'lucide-react'
import type { OdooAgentResponse } from '@/app/api/odoo/agents/route'

interface PanelState {
  agents: OdooAgentResponse[]
  isLoading: boolean
  error: string | null
}

export function AgentsPanel() {
  const [state, setState] = useState<PanelState>({
    agents: [], isLoading: true, error: null,
  })
  const [search, setSearch] = useState('')

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

  const filtered = search.trim()
    ? state.agents.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : state.agents

  const activeCount = state.agents.filter((a) => a.isActive).length
  const withOrdersCount = state.agents.filter((a) => a.orderCount > 0).length
  const linkedCount = state.agents.filter((a) => a.linkedUserId).length
  const totalOrders = state.agents.reduce((sum, a) => sum + a.orderCount, 0)

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total agentes</p>
            <p className="text-2xl font-bold">{state.agents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Con ordenes</p>
            <p className="text-2xl font-bold text-green-700">{withOrdersCount}</p>
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
            <p className="text-sm text-muted-foreground">Vinculados</p>
            <p className="text-2xl font-bold text-purple-700">{linkedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
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

      {/* Table */}
      {state.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead className="text-right">Ordenes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Plataforma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {search ? 'Sin resultados para la busqueda' : 'No se encontraron agentes en Odoo'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((agent) => (
                  <TableRow key={agent.odooTeamId}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {agent.orderCount > 0 ? (
                        <span className="font-medium">{agent.orderCount.toLocaleString('es-MX')}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={agent.isActive ? 'default' : 'outline'}
                        className={agent.isActive
                          ? 'bg-green-100 text-green-800 hover:bg-green-100'
                          : 'text-muted-foreground'}
                      >
                        {agent.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {agent.linkedUserId ? (
                        <Link
                          href="/superadmin/users"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        >
                          {agent.linkedUserDisplayName || 'Usuario'}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">No vinculado</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
