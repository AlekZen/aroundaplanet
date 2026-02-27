import { useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface UseAutoSaveOptions {
  endpoint: string
  debounceMs?: number
  onSuccess?: () => void
  onError?: (error: string) => void
}

/**
 * Auto-save hook: watches for data changes and saves via PATCH after debounce.
 * Shows toast feedback on success/error.
 * If a save is in progress when new data arrives, queues it for re-save after completion.
 */
export function useAutoSave<T extends Record<string, unknown>>({
  endpoint,
  debounceMs = 500,
  onSuccess,
  onError,
}: UseAutoSaveOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)
  const pendingDataRef = useRef<T | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const save = useCallback(
    (data: T) => {
      if (timerRef.current) clearTimeout(timerRef.current)

      timerRef.current = setTimeout(async () => {
        if (isSavingRef.current) {
          pendingDataRef.current = data
          return
        }
        isSavingRef.current = true
        pendingDataRef.current = null

        try {
          const response = await fetch(endpoint, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })

          if (!response.ok) {
            const body = await response.json().catch(() => ({}))
            throw new Error(body.message || 'Error al guardar')
          }

          toast.success('Datos guardados', { duration: 4000 })
          onSuccess?.()
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'No pudimos guardar — intenta de nuevo'
          toast.error(message, { duration: 0 }) // persist until dismiss
          onError?.(message)
        } finally {
          isSavingRef.current = false
          const pending = pendingDataRef.current
          if (pending) {
            pendingDataRef.current = null
            save(pending)
          }
        }
      }, debounceMs)
    },
    [endpoint, debounceMs, onSuccess, onError]
  )

  return { save }
}
