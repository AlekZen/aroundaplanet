'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface UserDeactivateDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  user: { uid: string; displayName: string; isActive: boolean } | null
  onConfirm: (uid: string, isActive: boolean, reason?: string) => Promise<void>
}

export function UserDeactivateDialog({ isOpen, onOpenChange, user, onConfirm }: UserDeactivateDialogProps) {
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  const isDeactivation = user.isActive

  async function handleConfirm() {
    if (!user) return
    setIsLoading(true)
    setError(null)
    try {
      await onConfirm(user.uid, !user.isActive, isDeactivation ? reason || undefined : undefined)
      setReason('')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  function handleCancel() {
    setReason('')
    onOpenChange(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isDeactivation ? 'Desactivar usuario' : 'Reactivar usuario'}
          </DialogTitle>
          <DialogDescription>
            {isDeactivation
              ? `Desactivar a ${user.displayName}? Este usuario no podra acceder a la plataforma. Sus datos e historial se conservan.`
              : `Reactivar a ${user.displayName}? El usuario podra volver a acceder.`}
          </DialogDescription>
        </DialogHeader>

        {isDeactivation && (
          <div className="space-y-2">
            <label htmlFor="deactivate-reason" className="text-sm font-medium text-foreground">
              Motivo (opcional)
            </label>
            <textarea
              id="deactivate-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe el motivo de la desactivacion..."
              className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent resize-none"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive px-1">{error}</p>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={handleCancel} disabled={isLoading}>
            Cancelar
          </Button>
          {isDeactivation ? (
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Desactivando...' : 'Desactivar'}
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Reactivando...' : 'Reactivar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
