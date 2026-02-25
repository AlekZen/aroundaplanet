'use client'
import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { WifiOff, Wifi, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { slideUp } from '@/lib/animations/variants'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface OfflineBannerProps {
  isOffline: boolean
  isReconnecting?: boolean
  lastSyncTimestamp?: Date
  className?: string
}

export function OfflineBanner({ isOffline, isReconnecting = false, lastSyncTimestamp, className }: OfflineBannerProps) {
  const variants = useReducedMotion(slideUp)
  const [showRestored, setShowRestored] = useState(false)
  const wasOfflineRef = useRef(false)

  useEffect(() => {
    if (isOffline || isReconnecting) {
      wasOfflineRef.current = true
      return
    }
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false
      const showTimer = setTimeout(() => setShowRestored(true), 0)
      const hideTimer = setTimeout(() => setShowRestored(false), 3000)
      return () => { clearTimeout(showTimer); clearTimeout(hideTimer) }
    }
  }, [isOffline, isReconnecting])

  const isVisible = isOffline || isReconnecting || showRestored

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div variants={variants} initial="hidden" animate="visible" exit="hidden">
          {isOffline && !isReconnecting && (
            <Alert
              role="alert"
              className={cn('border-destructive/30 bg-destructive/10 text-destructive rounded-none', className)}
            >
              <WifiOff className="h-4 w-4" />
              <AlertDescription className="flex items-center gap-2 text-sm">
                <span>Sin conexion a internet</span>
                {lastSyncTimestamp && (
                  <span className="text-xs text-muted-foreground">
                    Datos de hace {formatTimeAgo(lastSyncTimestamp)}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
          {isReconnecting && (
            <Alert
              role="status"
              className={cn('border-yellow-500/30 bg-yellow-50 text-yellow-700 rounded-none', className)}
            >
              <RefreshCw className="h-4 w-4 animate-spin" />
              <AlertDescription className="flex items-center gap-2 text-sm">
                <span>Reconectando...</span>
              </AlertDescription>
            </Alert>
          )}
          {showRestored && !isOffline && !isReconnecting && (
            <Alert
              role="status"
              className={cn('border-green-500/30 bg-green-50 text-green-700 rounded-none', className)}
            >
              <Wifi className="h-4 w-4" />
              <AlertDescription className="flex items-center gap-2 text-sm">
                <span>Conexion restaurada</span>
              </AlertDescription>
            </Alert>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}
