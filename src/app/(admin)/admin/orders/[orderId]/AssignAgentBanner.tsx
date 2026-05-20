'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, Loader2, UserCheck } from 'lucide-react'

interface AgentOption {
  uid: string
  name: string
  email: string | null
}

interface AssignAgentBannerProps {
  orderId: string
  currentAgentId: string | null
  currentAgentName: string | null
}

/**
 * Story 10.6 AC5 — Banner "Asignar agente" en /admin/orders/[orderId].
 *
 * Si la orden no tiene `agentId` asignado, muestra un banner rojo con
 * dropdown de agentes (users con rol agente). Al asignar, propaga al
 * contrato y a los pagos verified sin agentId.
 *
 * Sin agentId, el agente no puede ver ni el contrato ni los recibos de
 * sus clientes. Por eso es crítico para el flujo Story 10.6.
 */
export function AssignAgentBanner({ orderId, currentAgentId, currentAgentName }: AssignAgentBannerProps) {
  const router = useRouter()
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [selected, setSelected] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const hasAgent = typeof currentAgentId === 'string' && currentAgentId.length > 0

  useEffect(() => {
    if (hasAgent) return
    setIsLoading(true)
    fetch('/api/admin/agents-list')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Error ${r.status}`))))
      .then((data) => setAgents(data.agents ?? []))
      .catch(() => toast.error('No se pudieron cargar los agentes'))
      .finally(() => setIsLoading(false))
  }, [hasAgent])

  async function handleAssign() {
    if (!selected) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/assign-agent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId: selected }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? `Error ${res.status}`)
      toast.success(
        data.paymentsUpdated > 0
          ? `Agente asignado. Se actualizaron ${data.paymentsUpdated} pago(s) verificados.`
          : 'Agente asignado'
      )
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo asignar el agente')
    } finally {
      setIsSaving(false)
    }
  }

  if (hasAgent) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        <UserCheck className="h-4 w-4 shrink-0" />
        <span>
          Agente asignado: <span className="font-medium">{currentAgentName ?? currentAgentId}</span>
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-red-600 shrink-0" />
        <div className="space-y-3 flex-1">
          <div>
            <p className="font-semibold text-red-900">Esta orden no tiene agente asignado.</p>
            <p className="text-red-800 mt-0.5">
              Sin un agente, el vendedor freelance no podrá ver el contrato ni los recibos de pago en su portal.
              Asigna el agente correspondiente para habilitar la visibilidad.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={selected} onValueChange={setSelected} disabled={isLoading || isSaving}>
              <SelectTrigger className="flex-1 max-w-md bg-white">
                <SelectValue placeholder={isLoading ? 'Cargando agentes…' : 'Selecciona un agente'} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.uid} value={a.uid}>
                    {a.name}
                    {a.email && <span className="text-xs text-muted-foreground ml-2">({a.email})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssign} disabled={!selected || isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Asignar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
