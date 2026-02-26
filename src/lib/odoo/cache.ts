import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { AppError } from '@/lib/errors/AppError'
import { ODOO_CACHE_TTL } from '@/config/odoo'
import type { OdooCacheEntry, OdooCachedResult } from '@/types/odoo'

const CACHE_COLLECTION = 'odooCache'

function getCacheTtl(model: string): number {
  return ODOO_CACHE_TTL[model] ?? ODOO_CACHE_TTL['res.partner'] ?? 3600000
}

function modelToDocPath(model: string): string {
  return model.replace(/\./g, '-')
}

function isValidCacheEntry<T>(data: unknown): data is OdooCacheEntry<T> {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return 'data' in obj && 'cachedAt' in obj && 'odooModel' in obj && 'cacheKey' in obj
}

export async function getCached<T>(
  model: string,
  cacheKey: string
): Promise<OdooCachedResult<T> | null> {
  const docRef = adminDb
    .collection(CACHE_COLLECTION)
    .doc(modelToDocPath(model))
    .collection('entries')
    .doc(cacheKey)

  const snapshot = await docRef.get()
  if (!snapshot.exists) return null

  const raw = snapshot.data()
  if (!isValidCacheEntry<T>(raw)) return null

  const cachedAt = raw.cachedAt.toDate()
  const age = Date.now() - cachedAt.getTime()
  const ttl = getCacheTtl(model)

  return {
    data: raw.data as T,
    cachedAt,
    isStale: age > ttl,
  }
}

export async function setCache<T>(
  model: string,
  cacheKey: string,
  data: T
): Promise<void> {
  const docRef = adminDb
    .collection(CACHE_COLLECTION)
    .doc(modelToDocPath(model))
    .collection('entries')
    .doc(cacheKey)

  const entry: OdooCacheEntry<T> = {
    data,
    cachedAt: Timestamp.now(),
    odooModel: model,
    cacheKey,
  }

  await docRef.set(entry)
}

export async function withCacheFallback<T>(
  model: string,
  cacheKey: string,
  fetchFn: () => Promise<T>
): Promise<OdooCachedResult<T>> {
  const cached = await getCached<T>(model, cacheKey)

  if (cached && !cached.isStale) {
    return cached
  }

  try {
    const freshData = await fetchFn()
    await setCache(model, cacheKey, freshData)
    return {
      data: freshData,
      cachedAt: new Date(),
      isStale: false,
    }
  } catch (error) {
    console.error(`[OdooCache] Error fetching ${model}/${cacheKey}, ${cached ? 'returning stale cache' : 'no cache available'}:`, error)

    if (cached) {
      return { ...cached, isStale: true }
    }
    throw new AppError(
      'ODOO_UNAVAILABLE',
      'Odoo no disponible y no hay datos en cache',
      503,
      true
    )
  }
}
