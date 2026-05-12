/**
 * In-memory inflight + short-TTL response cache para endpoints que fan-out a Odoo.
 *
 * Motivacion: en dev mode (StrictMode + HMR + tab focus), la UI puede disparar
 * 3-5 GETs concurrentes contra el mismo endpoint. Sin dedup, cada uno pega Odoo
 * (~11s auth si singleton fue evictado por HMR + ~600ms searchRead).
 *
 * Estrategia:
 * - Si hay un fetch en vuelo para la clave: todos los callers comparten esa Promise.
 * - Tras resolver, cacheamos el valor por `ttlMs` (default 30s) → segundas N
 *   llamadas dentro de la ventana ni siquiera tocan Odoo.
 *
 * IMPORTANTE: se persiste en globalThis para sobrevivir HMR. Solo usar para
 * GETs idempotentes contra terceros lentos.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

interface InflightStore {
  inflight: Map<string, Promise<unknown>>
  responses: Map<string, CacheEntry<unknown>>
}

interface InflightGlobal {
  __inflightCache?: InflightStore
}

function store(): InflightStore {
  const g = globalThis as unknown as InflightGlobal
  if (!g.__inflightCache) {
    g.__inflightCache = { inflight: new Map(), responses: new Map() }
  }
  return g.__inflightCache
}

/**
 * Ejecuta `fetcher` con dedup + TTL cache.
 *
 * @param key  Clave única (incluir params relevantes).
 * @param fetcher Función que produce la Promise costosa.
 * @param ttlMs Cuánto cachear la respuesta exitosa (default 30s).
 */
export async function dedupInflight<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 30_000,
): Promise<T> {
  const s = store()
  const now = Date.now()

  const cached = s.responses.get(key)
  if (cached && cached.expiresAt > now) {
    return cached.value as T
  }

  const inflight = s.inflight.get(key)
  if (inflight) {
    return inflight as Promise<T>
  }

  const promise = (async () => {
    try {
      const value = await fetcher()
      s.responses.set(key, { value, expiresAt: Date.now() + ttlMs })
      return value
    } finally {
      s.inflight.delete(key)
    }
  })()
  s.inflight.set(key, promise)
  return promise
}

export function clearInflightCache(): void {
  const s = store()
  s.inflight.clear()
  s.responses.clear()
}
