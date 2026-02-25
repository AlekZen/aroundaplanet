'use client'

import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
  className?: string
}

export function ErrorPage({ error, reset, className }: ErrorPageProps) {
  return (
    <div className={cn('flex min-h-[50vh] flex-col items-center justify-center gap-6 p-4', className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive-muted">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Algo salio mal
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Ocurrio un error inesperado. Por favor intenta de nuevo.
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <p className="text-xs text-destructive font-mono mt-2 max-w-lg break-words">
            {error.message}
          </p>
        )}
      </div>
      <Button
        onClick={reset}
        className="min-h-11 bg-primary text-primary-foreground hover:bg-primary-light"
      >
        Intentar de nuevo
      </Button>
    </div>
  )
}
