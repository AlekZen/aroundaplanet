/**
 * Story 9.2 smoke — inspecciona account.payment + ir.model.data en Odoo.
 * Uso:
 *   node scripts/verify-9-2-odoo.mjs <firestorePaymentId>
 *   node scripts/verify-9-2-odoo.mjs --list-journals
 */
import xmlrpc from 'xmlrpc'
import { readFileSync } from 'fs'
import { resolve } from 'path'

try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const { ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY } = process.env
if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_API_KEY) {
  console.error('[fail] faltan ODOO_URL/ODOO_DB/ODOO_USERNAME/ODOO_API_KEY')
  process.exit(1)
}

const host = new URL(ODOO_URL).hostname
const common = xmlrpc.createSecureClient({ host, port: 443, path: '/xmlrpc/2/common' })
const object = xmlrpc.createSecureClient({ host, port: 443, path: '/xmlrpc/2/object' })

const call = (client, method, params) =>
  new Promise((res, rej) => client.methodCall(method, params, (err, val) => (err ? rej(err) : res(val))))

const uid = await call(common, 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
if (!uid) throw new Error('auth failed')
const exec = (model, method, args, kw = {}) =>
  call(object, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kw])

const arg = process.argv[2]
if (!arg) {
  console.error('Uso: node scripts/verify-9-2-odoo.mjs <firestorePaymentId> | --list-journals')
  process.exit(1)
}

if (arg === '--list-journals') {
  const rows = await exec('account.journal', 'search_read', [[['type', 'in', ['bank', 'cash']]]], {
    fields: ['id', 'name', 'code', 'type'],
    limit: 50,
  })
  console.log(JSON.stringify(rows, null, 2))
  process.exit(0)
}

const firestoreId = arg
const extIdRows = await exec(
  'ir.model.data',
  'search_read',
  [[['module', '=', '__aroundaplanet__'], ['name', '=', `payment_${firestoreId}`], ['model', '=', 'account.payment']]],
  { fields: ['id', 'res_id'], limit: 1 },
)
if (!extIdRows.length) {
  console.log(JSON.stringify({ firestoreId, irModelData: null, payment: null }, null, 2))
  console.log('\n[CHECK] No existe ir.model.data — el push aún no se ejecutó o falló antes de reservar.')
  process.exit(0)
}
const extId = extIdRows[0]
const paymentRows = extId.res_id
  ? await exec(
      'account.payment',
      'search_read',
      [[['id', '=', extId.res_id]]],
      { fields: ['id', 'name', 'state', 'amount', 'date', 'memo', 'partner_id', 'journal_id', 'x_firebase_payment_id'], limit: 1 },
    )
  : []

console.log(
  JSON.stringify(
    {
      firestoreId,
      irModelData: extId,
      payment: paymentRows[0] ?? null,
    },
    null,
    2,
  ),
)

const p = paymentRows[0]
if (p && p.x_firebase_payment_id === firestoreId && p.state === 'draft') {
  console.log('\n[OK] payment Odoo creado correctamente con custom field')
} else if (extId.res_id === 0) {
  console.log('\n[CHECK] ir.model.data reservado (res_id=0) — recovery pending, no se completó write res_id')
} else {
  console.log('\n[CHECK] inconsistencia entre ir.model.data y account.payment — revisar manual')
}
process.exit(0)
