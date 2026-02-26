import type { Timestamp } from 'firebase-admin/firestore'

export interface OdooConfig {
  url: string
  db: string
  username: string
  apiKey: string
}

export interface OdooSearchOptions {
  offset?: number
  limit?: number
  order?: string
}

export interface OdooReadGroupOptions {
  groupby: string[]
  lazy?: boolean
  offset?: number
  limit?: number
  orderby?: string
}

export type OdooDomainOperator =
  | '=' | '!=' | '>' | '>=' | '<' | '<='
  | 'like' | 'ilike' | 'not like' | 'not ilike'
  | 'in' | 'not in'
  | 'child_of' | 'parent_of'

export type OdooDomainCondition = [string, OdooDomainOperator, unknown]
export type OdooDomainLogical = '&' | '|' | '!'
export type OdooDomain = Array<OdooDomainCondition | OdooDomainLogical>

export interface OdooRecord {
  id: number
  [key: string]: unknown
}

export interface OdooCacheEntry<T = unknown> {
  data: T
  cachedAt: Timestamp
  odooModel: string
  cacheKey: string
}

export interface OdooCachedResult<T = unknown> {
  data: T
  cachedAt: Date
  isStale: boolean
}
