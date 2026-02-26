// Odoo integration configuration constants

export const ODOO_TIMEOUT_MS = 5000
export const ODOO_MAX_RETRIES = 3
export const ODOO_RETRY_DELAYS = [1000, 2000, 4000] as const
export const ODOO_RATE_LIMIT_PER_MIN = 60
export const ODOO_DEFAULT_PAGE_SIZE = 100

export const ODOO_CACHE_TTL: Record<string, number> = {
  'product.product': 24 * 60 * 60 * 1000,
  'res.partner': 1 * 60 * 60 * 1000,
  'sale.order': 15 * 60 * 1000,
  'account.move': 1 * 60 * 60 * 1000,
  kpis: 5 * 60 * 1000,
}

export const ODOO_XMLRPC_PATHS = {
  COMMON: '/xmlrpc/2/common',
  OBJECT: '/xmlrpc/2/object',
} as const
