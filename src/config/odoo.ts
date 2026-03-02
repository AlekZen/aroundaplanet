// Odoo integration configuration constants

export const ODOO_TIMEOUT_MS = 5000
export const ODOO_MAX_RETRIES = 3
export const ODOO_RETRY_DELAYS = [1000, 2000, 4000] as const
export const ODOO_RATE_LIMIT_PER_MIN = 60
export const ODOO_DEFAULT_PAGE_SIZE = 100

export const ODOO_CACHE_TTL: Record<string, number> = {
  'product.product': 24 * 60 * 60 * 1000,    // 24h — product variants (rarely change)
  'product.template': 24 * 60 * 60 * 1000,   // 24h — trip products (sync updates Firestore)
  'product.document': 24 * 60 * 60 * 1000,   // 24h — attached documents (rarely change)
  'ir.attachment': 24 * 60 * 60 * 1000,       // 24h — binary attachments
  'res.partner': 1 * 60 * 60 * 1000,          // 1h — contacts/customers
  'res.users': 1 * 60 * 60 * 1000,            // 1h — Odoo users
  'crm.team': 1 * 60 * 60 * 1000,             // 1h — sales teams
  'sale.order': 1 * 60 * 60 * 1000,           // 1h — sales orders (was 15min, reduced for Odoo protection)
  'sale.order.line': 1 * 60 * 60 * 1000,      // 1h — order lines
  'account.move': 1 * 60 * 60 * 1000,         // 1h — invoices
  'event.event': 24 * 60 * 60 * 1000,         // 24h — events/departures
  'event.event.ticket': 24 * 60 * 60 * 1000,  // 24h — event tickets
  kpis: 5 * 60 * 1000,                        // 5min — real-time KPIs
}

export const ODOO_XMLRPC_PATHS = {
  COMMON: '/xmlrpc/2/common',
  OBJECT: '/xmlrpc/2/object',
} as const
