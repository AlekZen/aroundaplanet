/**
 * Spike 9.0a — Cleanup follow-up: cancela payments draft leftovers + intenta cleanup ACL-locked attachment.
 *
 * - Cancela todos los account.payment con memo `%TEST_AROUNDA_2026-05-12_spike9-0a-%` que sigan state='draft'
 *   usando write({state:'canceled'}) (Odoo 18 valor correcto).
 * - Intenta renombrar attachment 45803 (ACL-locked por res_id huérfano) — esperado: falla, dejamos el ID
 *   documentado para que Paloma lo limpie manualmente con cuenta admin.
 */
import xmlrpc from 'xmlrpc'
import { readFileSync, writeFileSync, appendFileSync } from 'fs'
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
const mkClient = (p) => xmlrpc.createSecureClient({ host, port: 443, path: p })
const common = mkClient('/xmlrpc/2/common')
const object = mkClient('/xmlrpc/2/object')
const call = (c, m, p, t = 60000) => new Promise((r, j) => {
  const to = setTimeout(() => j(new Error(`timeout ${m}`)), t)
  c.methodCall(m, p, (e, v) => { clearTimeout(to); e ? j(e) : r(v) })
})

async function main() {
  const uid = await call(common, 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
  const exec = (model, method, args, kwargs = {}) => call(object, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs])
  console.log(`[auth] uid=${uid}`)

  // Cancel pending draft payments
  // Buscar drafts por id explícito (8131, 8132) y también por memo with %_CLEANED_% que tengan state=draft
  const drafts = await exec('account.payment', 'search_read',
    [['|', ['id', 'in', [8131, 8132]], '&', ['memo', 'like', '%TEST_AROUNDA_2026-05-12_spike9-0a-%'], ['state', '=', 'draft']]],
    { fields: ['id', 'memo', 'state'], limit: 100 },
  )
  console.log(`[drafts] ${drafts.length} pendientes`)
  const cancelled = []
  for (const p of drafts) {
    try {
      await exec('account.payment', 'write', [[p.id], { state: 'canceled' }])
      cancelled.push(p.id)
      console.log(`  ✓ cancelled ${p.id}`)
    } catch (e) {
      console.log(`  ✗ ${p.id} ${e?.message?.split('\n')[0]}`)
    }
  }

  // Verify
  const stillDraft = await exec('account.payment', 'search_count',
    [[['memo', 'like', '%TEST_AROUNDA_2026-05-12_spike9-0a-%'], ['state', '=', 'draft']]],
  )
  console.log(`[verify] drafts restantes: ${stillDraft}`)

  // ACL-locked attachment 45803
  console.log(`[orphan-att] intentando renombrar 45803 (esperado: falla ACL)`)
  let orphanResult = 'unknown'
  try {
    await exec('ir.attachment', 'write', [[45803], { name: `EDGE_orphan_45803_NEEDS_ADMIN_CLEANUP_${new Date().toISOString().replace(/[:.]/g, '-')}` }])
    orphanResult = 'renamed-ok'
  } catch (e) {
    orphanResult = `acl-blocked: ${e?.message?.split('\n')[0]}`
  }
  console.log(`  result: ${orphanResult}`)

  const outPath = resolve(process.cwd(), 'scripts/audit-output/spike-9-0a-cleanup-followup.json')
  writeFileSync(outPath, JSON.stringify({
    finishedAt: new Date().toISOString(),
    cancelledPaymentIds: cancelled,
    draftsRemaining: stillDraft,
    orphanAttachment45803Result: orphanResult,
  }, null, 2), 'utf8')
  console.log(`[ok] ${outPath}`)

  // Append to cleanup list
  const cleanupPath = resolve(process.cwd(), '_bmad-output/implementation-artifacts/spikes/9-0a-cleanup-list.txt')
  appendFileSync(cleanupPath,
    `\n# Followup ${new Date().toISOString()}\n` +
    cancelled.map(id => `account.payment:${id}:state=canceled (followup)`).join('\n') + '\n' +
    `ir.attachment:45803:ACL-LOCKED-NEEDS-ADMIN-CLEANUP (orphan res_id=999999 — record rules bloquean acceso al user '${ODOO_USERNAME}')\n`,
    'utf8',
  )
  console.log(`[ok] appended to ${cleanupPath}`)
}

main().catch(e => { console.error('[fail]', e?.message); process.exit(1) })
