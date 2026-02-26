import xmlrpc from 'xmlrpc'
import { AppError } from '@/lib/errors/AppError'
import type {
  OdooConfig,
  OdooRecord,
  OdooSearchOptions,
  OdooReadGroupOptions,
  OdooDomain,
} from '@/types/odoo'
import {
  ODOO_TIMEOUT_MS,
  ODOO_MAX_RETRIES,
  ODOO_RETRY_DELAYS,
  ODOO_RATE_LIMIT_PER_MIN,
  ODOO_DEFAULT_PAGE_SIZE,
  ODOO_XMLRPC_PATHS,
} from '@/config/odoo'

type XmlRpcClient = ReturnType<typeof xmlrpc.createSecureClient>

export class OdooClient {
  private config: OdooConfig
  private commonClient: XmlRpcClient
  private objectClient: XmlRpcClient
  private uid: number | null = null
  private authPromise: Promise<number> | null = null
  private lastRequestTime = 0
  private requestQueue: Array<() => void> = []
  private isProcessingQueue = false

  constructor(config: OdooConfig) {
    this.config = config
    const urlObj = new URL(config.url)

    this.commonClient = xmlrpc.createSecureClient({
      host: urlObj.hostname,
      port: Number(urlObj.port) || 443,
      path: ODOO_XMLRPC_PATHS.COMMON,
    })

    this.objectClient = xmlrpc.createSecureClient({
      host: urlObj.hostname,
      port: Number(urlObj.port) || 443,
      path: ODOO_XMLRPC_PATHS.OBJECT,
    })
  }

  async authenticate(): Promise<number> {
    if (this.uid !== null) return this.uid
    if (this.authPromise) return this.authPromise

    this.authPromise = (async () => {
      try {
        const uid = await this.xmlRpcCall<number | false>(
          this.commonClient,
          'authenticate',
          [this.config.db, this.config.username, this.config.apiKey, {}]
        )

        if (uid === false || typeof uid !== 'number') {
          throw new AppError('ODOO_AUTH_FAILED', 'Credenciales Odoo invalidas', 401, false)
        }

        this.uid = uid
        return uid
      } finally {
        this.authPromise = null
      }
    })()

    return this.authPromise
  }

  async search(
    model: string,
    domain: OdooDomain = [],
    options: OdooSearchOptions = {}
  ): Promise<number[]> {
    return this.executeKw<number[]>(model, 'search', [domain], {
      offset: options.offset ?? 0,
      limit: options.limit ?? ODOO_DEFAULT_PAGE_SIZE,
      ...(options.order ? { order: options.order } : {}),
    })
  }

  async read(
    model: string,
    ids: number[],
    fields: string[] = []
  ): Promise<OdooRecord[]> {
    return this.executeKw<OdooRecord[]>(model, 'read', [ids], {
      fields,
    })
  }

  async searchRead(
    model: string,
    domain: OdooDomain = [],
    fields: string[] = [],
    options: OdooSearchOptions = {}
  ): Promise<OdooRecord[]> {
    return this.executeKw<OdooRecord[]>(model, 'search_read', [domain], {
      fields,
      offset: options.offset ?? 0,
      limit: options.limit ?? ODOO_DEFAULT_PAGE_SIZE,
      ...(options.order ? { order: options.order } : {}),
    })
  }

  async readGroup(
    model: string,
    domain: OdooDomain = [],
    fields: string[] = [],
    options: OdooReadGroupOptions
  ): Promise<OdooRecord[]> {
    return this.executeKw<OdooRecord[]>(model, 'read_group', [domain], {
      fields,
      groupby: options.groupby,
      lazy: options.lazy ?? false,
      ...(options.offset !== undefined ? { offset: options.offset } : {}),
      ...(options.limit !== undefined ? { limit: options.limit } : {}),
      ...(options.orderby ? { orderby: options.orderby } : {}),
    })
  }

  async create(
    model: string,
    values: Record<string, unknown>
  ): Promise<number> {
    return this.executeKw<number>(model, 'create', [values], {})
  }

  async write(
    model: string,
    ids: number[],
    values: Record<string, unknown>
  ): Promise<boolean> {
    return this.executeKw<boolean>(model, 'write', [ids, values], {})
  }

  resetAuth(): void {
    this.uid = null
    this.authPromise = null
  }

  // --- Core XML-RPC execution ---

  private async executeKw<T>(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown>
  ): Promise<T> {
    const uid = await this.authenticate()
    return this.withRetry(() =>
      this.rateLimitedCall<T>(
        this.objectClient,
        'execute_kw',
        [this.config.db, uid, this.config.apiKey, model, method, args, kwargs]
      )
    )
  }

  private xmlRpcCall<T>(
    client: XmlRpcClient,
    method: string,
    params: unknown[]
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new AppError('ODOO_TIMEOUT', 'Odoo no respondio en 5s', 503, true))
      }, ODOO_TIMEOUT_MS)

      client.methodCall(method, params, (error: object | null, value: T) => {
        clearTimeout(timeout)
        if (error) {
          reject(this.mapXmlRpcError(error instanceof Error ? error : new Error(String(error))))
          return
        }
        resolve(value)
      })
    })
  }

  // --- Rate limiter ---

  private rateLimitedCall<T>(
    client: XmlRpcClient,
    method: string,
    params: unknown[]
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const execute = () => {
        const now = Date.now()
        const minInterval = (60 * 1000) / ODOO_RATE_LIMIT_PER_MIN
        const elapsed = now - this.lastRequestTime
        const waitTime = Math.max(0, minInterval - elapsed)

        setTimeout(() => {
          this.lastRequestTime = Date.now()
          this.xmlRpcCall<T>(client, method, params).then(resolve).catch(reject)
          this.processQueue()
        }, waitTime)
      }

      if (this.isProcessingQueue) {
        this.requestQueue.push(execute)
      } else {
        this.isProcessingQueue = true
        execute()
      }
    })
  }

  private processQueue(): void {
    const next = this.requestQueue.shift()
    if (next) {
      next()
    } else {
      this.isProcessingQueue = false
    }
  }

  // --- Retry with exponential backoff ---

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= ODOO_MAX_RETRIES; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (error instanceof AppError && !error.retryable) {
          throw error
        }

        if (attempt < ODOO_MAX_RETRIES) {
          const delay = ODOO_RETRY_DELAYS[attempt] ?? ODOO_RETRY_DELAYS[ODOO_RETRY_DELAYS.length - 1]
          await this.sleep(delay)
        }
      }
    }

    throw lastError ?? new AppError('ODOO_UNAVAILABLE', 'Odoo no disponible despues de reintentos', 503, true)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // --- Error mapping ---

  private mapXmlRpcError(error: Error): AppError {
    const message = error.message || 'Error de comunicacion con Odoo'

    if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
      return new AppError('ODOO_UNAVAILABLE', 'Odoo no disponible', 503, true)
    }

    if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
      return new AppError('ODOO_TIMEOUT', 'Odoo no respondio a tiempo', 503, true)
    }

    if (message.includes('AccessDenied') || message.includes('Access Denied')) {
      return new AppError('ODOO_AUTH_FAILED', 'Acceso denegado por Odoo', 401, false)
    }

    if (message.includes('429') || message.includes('Too Many Requests') || message.includes('rate')) {
      return new AppError('ODOO_RATE_LIMITED', 'Limite de requests Odoo alcanzado', 429, true)
    }

    if (message.includes('does not exist') || message.includes('not found')) {
      return new AppError('ODOO_NOT_FOUND', `Recurso no encontrado en Odoo: ${message}`, 404, false)
    }

    if (message.includes('ValidationError') || message.includes('Invalid')) {
      return new AppError('ODOO_VALIDATION', `Error de validacion Odoo: ${message}`, 400, false)
    }

    return new AppError('ODOO_UNAVAILABLE', `Error Odoo: ${message}`, 500, true)
  }
}

// --- Singleton ---

let odooClient: OdooClient | null = null

export function getOdooClient(): OdooClient {
  if (odooClient) return odooClient

  const url = process.env.ODOO_URL
  const db = process.env.ODOO_DB
  const username = process.env.ODOO_USERNAME
  const apiKey = process.env.ODOO_API_KEY

  if (!url || !db || !username || !apiKey) {
    throw new AppError(
      'ODOO_AUTH_FAILED',
      'Faltan variables de entorno Odoo (ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY)',
      500,
      false
    )
  }

  odooClient = new OdooClient({ url, db, username, apiKey })
  return odooClient
}

export function resetOdooClient(): void {
  odooClient = null
}
