/**
 * Story 9.2 — Cola de sync Odoo con concurrency=1 + min-interval.
 *
 * Use case: batch retry de pagos en error (botón "Reintentar todos" futuro,
 * Story 9.6). Para verify user-driven (1 click admin) NO se usa este wrapper.
 *
 * Implementación inline (sin `p-limit`) — chain de promises + sleep entre flows.
 */

const DEFAULT_MIN_INTERVAL_MS = 2_000

let chain: Promise<unknown> = Promise.resolve()
let lastRun = 0
let configuredInterval = DEFAULT_MIN_INTERVAL_MS

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

/**
 * Encola una operación. Garantiza:
 *  - max 1 flow en vuelo (concurrency=1)
 *  - mínimo `intervalMs` ms entre el inicio de un flow y el siguiente
 *
 * Si `fn` rinde con error, NO rompe la cadena — los siguientes flows continúan.
 */
export function enqueueOdooSync<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(async () => {
    const elapsed = Date.now() - lastRun
    if (elapsed < configuredInterval) await sleep(configuredInterval - elapsed)
    lastRun = Date.now()
    return fn()
  })
  // Swallow rejections en la cadena interna para que no rompan flows siguientes.
  chain = next.catch(() => undefined)
  return next as Promise<T>
}

/** Reset para tests. */
export function __resetOdooSyncQueue(intervalMs: number = DEFAULT_MIN_INTERVAL_MS): void {
  chain = Promise.resolve()
  lastRun = 0
  configuredInterval = intervalMs
}
