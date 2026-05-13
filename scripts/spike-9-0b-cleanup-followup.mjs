/**
 * Cleanup follow-up del spike 9.0b.
 *
 * Llama action_cancel a cada payment. xmlrpc retorna fault "cannot marshal None"
 * porque action_cancel devuelve None — eso NO es fallo real de Odoo, es limitación
 * del client. Tratamos esa cadena como éxito.
 *
 * Verifica state final con read post-cleanup.
 */
import xmlrpc from 'xmlrpc'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const { ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY } = process.env
const host = new URL(ODOO_URL).hostname
const mk = (p) => xmlrpc.createSecureClient({ host, port: 443, path: p })
const common = mk('/xmlrpc/2/common')
const object = mk('/xmlrpc/2/object')
const call = (c, m, p) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('timeout')), 60000)
  c.methodCall(m, p, (e, v) => { clearTimeout(t); e ? rej(e) : res(v) })
})

async function main() {
  const uid = await call(common, 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
  console.log(`[auth] uid=${uid}`)

  const prev = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/audit-output/spike-9-0b-output.json'), 'utf8'))
  const paymentIds = prev.paymentIdsCreated

  const results = []
  for (const pid of paymentIds) {
    let cancelOk = false
    let cancelErr = null
    try {
      await call(object, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, 'account.payment', 'action_cancel', [[pid]], {}])
      cancelOk = true
    } catch (e) {
      const msg = e?.message ?? String(e)
      // Odoo retorna None -> client falla marshalling, pero la operación SI se aplicó server-side.
      if (msg.includes('cannot marshal None')) {
        cancelOk = true
        cancelErr = 'marshal-none-but-applied'
      } else {
        cancelErr = msg.slice(0, 200)
      }
    }
    results.push({ pid, cancelOk, cancelErr })
  }

  // Verificación final
  const final = await call(object, 'execute_kw',
    [ODOO_DB, uid, ODOO_API_KEY, 'account.payment', 'read', [paymentIds], { fields: ['id', 'name', 'state'] }],
  )
  const byState = {}
  for (const r of final) byState[r.state] = (byState[r.state] ?? 0) + 1

  const out = {
    finishedAt: new Date().toISOString(),
    paymentIds,
    actionCancelResults: results,
    finalRows: final.map(r => ({ id: r.id, name: r.name, state: r.state })),
    finalStateCounts: byState,
  }
  writeFileSync(resolve(process.cwd(), 'scripts/audit-output/spike-9-0b-cleanup-followup.json'), JSON.stringify(out, null, 2))
  console.log('[counts]', byState)
  console.log('[sample]', final.slice(0, 3).map(r => ({ id: r.id, state: r.state, name: r.name })))
}

main().catch(e => { console.error('[fail]', e?.message); process.exit(1) })
