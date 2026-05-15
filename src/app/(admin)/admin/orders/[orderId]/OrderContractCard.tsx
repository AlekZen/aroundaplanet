'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ContractTemplate } from '@/schemas/contractTemplateSchema'

interface Props {
  orderId: string
  orderTotalCents: number
  existingContractId: string | null
  existingPdfUrl: string | null
  existingVersion: number | null
  contactName: string | null
  sharedWithClient: boolean
  sharedWithAgent: boolean
  acceptedAt: string | null
  acceptedByName: string | null
  hasAgent: boolean
  hasClientUser: boolean
}

type GenerateState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; contractId: string; pdfUrl: string; version: number }
  | { kind: 'error'; message: string }

export function OrderContractCard(props: Props) {
  const [templates, setTemplates] = useState<ContractTemplate[] | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [nombreOverride, setNombreOverride] = useState<string>(props.contactName ?? '')
  const [acompanantes, setAcompanantes] = useState<string>('')
  const [anticipoPesos, setAnticipoPesos] = useState<string>('')
  const [state, setState] = useState<GenerateState>({ kind: 'idle' })
  const [sharedWithClient, setSharedWithClient] = useState(props.sharedWithClient)
  const [sharedWithAgent, setSharedWithAgent] = useState(props.sharedWithAgent)
  const [shareError, setShareError] = useState<string | null>(null)
  const [sharePending, setSharePending] = useState<'client' | 'agent' | null>(null)

  async function toggleShare(target: 'client' | 'agent', next: boolean) {
    if (!props.existingContractId) return
    setSharePending(target)
    setShareError(null)
    try {
      const body =
        target === 'client' ? { sharedWithClient: next } : { sharedWithAgent: next }
      const r = await fetch(`/api/contracts/${props.existingContractId}/share`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.message ?? `HTTP ${r.status}`)
      setSharedWithClient(data.sharedWithClient)
      setSharedWithAgent(data.sharedWithAgent)
    } catch (e) {
      setShareError((e as Error).message)
    } finally {
      setSharePending(null)
    }
  }

  useEffect(() => {
    let aborted = false
    fetch('/api/contract-templates')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const data = (await r.json()) as { templates: ContractTemplate[] }
        if (!aborted) {
          setTemplates(data.templates)
          if (data.templates.length > 0 && !selectedTemplateId) {
            setSelectedTemplateId(data.templates[0]!.templateId)
          }
        }
      })
      .catch(() => {
        if (!aborted) setTemplates([])
      })
      .finally(() => {
        if (!aborted) setLoadingTemplates(false)
      })
    return () => {
      aborted = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGenerate() {
    if (!selectedTemplateId) return
    setState({ kind: 'submitting' })
    try {
      const anticipoCents = anticipoPesos.trim()
        ? Math.round(Number(anticipoPesos) * 100)
        : null

      const body: Record<string, unknown> = { templateId: selectedTemplateId }
      const overrides: Record<string, unknown> = {}
      if (nombreOverride.trim() && nombreOverride.trim() !== (props.contactName ?? '')) {
        overrides.nombreCliente = nombreOverride.trim()
      }
      if (acompanantes.trim()) overrides.nombreAcompanantes = acompanantes.trim()
      if (anticipoCents && anticipoCents > 0) overrides.anticipoCents = anticipoCents
      if (Object.keys(overrides).length > 0) body.snapshotOverrides = overrides

      const res = await fetch(`/api/contracts/from-order/${props.orderId}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setState({ kind: 'error', message: data?.message ?? `Error HTTP ${res.status}` })
        return
      }
      setState({
        kind: 'success',
        contractId: data.contractId,
        pdfUrl: data.pdfUrl,
        version: data.version,
      })
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message })
    }
  }

  const hasExisting = props.existingContractId && props.existingPdfUrl

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Contrato</h2>
        {hasExisting ? (
          <a
            href={props.existingPdfUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline"
          >
            Ver contrato actual (v{props.existingVersion ?? 1})
          </a>
        ) : null}
      </div>

      {props.orderTotalCents <= 0 ? (
        <p className="rounded border-l-4 border-yellow-500 bg-yellow-50 p-3 text-sm">
          ⚠️ Esta orden no tiene <code>amountTotalCents</code> capturado. Configúralo antes de generar
          el contrato.
        </p>
      ) : null}

      {loadingTemplates ? (
        <Skeleton className="h-10 w-full" />
      ) : templates && templates.length > 0 ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Plantilla</label>
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona destino" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.templateId} value={t.templateId}>
                  {t.destinoLabel} {t.scope === 'nacional' ? '(nacional)' : '(internacional)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No hay plantillas activas. Contacta soporte.
        </p>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Nombre del cliente (en mayúsculas)</label>
        <Input
          value={nombreOverride}
          onChange={(e) => setNombreOverride(e.target.value)}
          placeholder="Nombre completo del titular"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Acompañantes (opcional)</label>
        <Input
          value={acompanantes}
          onChange={(e) => setAcompanantes(e.target.value)}
          placeholder="Déjalo vacío si viaja solo. Ejemplo: Y JUAN PÉREZ GARCÍA"
        />
        <p className="text-xs text-muted-foreground">
          Aparece en el contrato precedido por “Y” solo si lo escribes.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Anticipo en pesos (opcional)</label>
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={anticipoPesos}
          onChange={(e) => setAnticipoPesos(e.target.value)}
          placeholder="Déjalo vacío para pago inmediato"
        />
        <p className="text-xs text-muted-foreground">
          Si se deja vacío, la cláusula segunda se redacta como pago inmediato.
        </p>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={
          state.kind === 'submitting' ||
          !selectedTemplateId ||
          props.orderTotalCents <= 0
        }
        className="w-full"
      >
        {state.kind === 'submitting'
          ? 'Generando...'
          : hasExisting
            ? `Regenerar contrato (v${(props.existingVersion ?? 1) + 1})`
            : 'Generar contrato PDF'}
      </Button>

      {state.kind === 'success' ? (
        <div className="rounded border-l-4 border-green-500 bg-green-50 p-3 text-sm">
          ✅ Contrato v{state.version} generado.{' '}
          <a
            href={state.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline"
          >
            Abrir PDF
          </a>
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <div className="rounded border-l-4 border-red-500 bg-red-50 p-3 text-sm">
          ❌ {state.message}
        </div>
      ) : null}

      {props.existingContractId ? (
        <div className="border-t border-border pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Visibilidad y firma</h3>

          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={sharedWithClient}
                disabled={sharePending === 'client' || !props.hasClientUser}
                onChange={(e) => void toggleShare('client', e.target.checked)}
              />
              <span>
                <strong className="block">Compartir con cliente</strong>
                <span className="text-xs text-muted-foreground">
                  Permite al cliente ver el PDF en <code>/client/contracts</code> y aceptar los
                  términos.
                  {!props.hasClientUser && ' La orden no tiene clientUserId asociado.'}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={sharedWithAgent}
                disabled={sharePending === 'agent' || !props.hasAgent}
                onChange={(e) => void toggleShare('agent', e.target.checked)}
              />
              <span>
                <strong className="block">Compartir con agente</strong>
                <span className="text-xs text-muted-foreground">
                  Permite al agente asignado ver el contrato en <code>/agent/contracts</code>.
                  {!props.hasAgent && ' La orden no tiene agente asignado.'}
                </span>
              </span>
            </label>
          </div>

          {shareError ? (
            <div className="rounded border-l-4 border-red-500 bg-red-50 p-2 text-xs">
              ❌ {shareError}
            </div>
          ) : null}

          {props.acceptedAt ? (
            <div className="rounded border-l-4 border-green-500 bg-green-50 p-3 text-xs">
              ✅ Aceptado por <strong>{props.acceptedByName ?? 'cliente'}</strong> el{' '}
              {new Date(props.acceptedAt).toLocaleString('es-MX')}
            </div>
          ) : sharedWithClient ? (
            <div className="rounded border-l-4 border-yellow-500 bg-yellow-50 p-3 text-xs">
              ⏳ Compartido con el cliente, pendiente de aceptación.
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
