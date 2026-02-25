'use client'
import { useState } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, X } from 'lucide-react'

interface VerificationPanelProps {
  payment?: { id: string; amount: number; agentName: string; clientName: string; date: string }
  receipt?: { imageUrl: string; ocrData?: Record<string, string> }
  onVerify?: () => void
  onReject?: (reason: string) => void
  className?: string
}

export function VerificationPanel({ payment, receipt, onVerify, onReject, className }: VerificationPanelProps) {
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  if (!payment) {
    return (
      <Card className={cn('p-6', className)}>
        <CardContent className="p-0 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    )
  }

  function handleRejectClick() {
    if (!isRejecting) {
      setIsRejecting(true)
      return
    }
    onReject?.(rejectReason)
    setIsRejecting(false)
    setRejectReason('')
  }

  function handleCancelReject() {
    setIsRejecting(false)
    setRejectReason('')
  }

  return (
    <Card className={cn('p-0 overflow-hidden', className)} aria-label={`Verificacion de pago ${payment.id}`}>
      <CardHeader className="p-4 border-b border-border">
        <CardTitle className="font-heading text-lg">Pago #{payment.id}</CardTitle>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Agente: {payment.agentName}</p>
          <p>Cliente: {payment.clientName}</p>
          <p>Fecha: {payment.date}</p>
          <p className="font-mono text-foreground font-medium">{formatCurrency(payment.amount)}</p>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {receipt && (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm">
            Comprobante: {receipt.imageUrl}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Atajos: V = Verificar, R = Rechazar</p>
        {isRejecting && (
          <div className="space-y-2">
            <label htmlFor="reject-reason" className="text-sm font-medium text-foreground">
              Motivo de rechazo
            </label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Describe el motivo del rechazo..."
              className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent resize-none"
              aria-label="Motivo de rechazo"
            />
          </div>
        )}
        <div className="flex gap-3">
          {!isRejecting && (
            <Button onClick={onVerify} className="min-h-11 flex-1 bg-green-600 text-white hover:bg-green-700">
              <Check className="mr-2 h-4 w-4" /> Verificar
            </Button>
          )}
          {isRejecting && (
            <Button onClick={handleCancelReject} variant="outline" className="min-h-11 flex-1">
              Cancelar
            </Button>
          )}
          <Button onClick={handleRejectClick} variant="destructive" className="min-h-11 flex-1">
            <X className="mr-2 h-4 w-4" /> {isRejecting ? 'Confirmar rechazo' : 'Rechazar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
