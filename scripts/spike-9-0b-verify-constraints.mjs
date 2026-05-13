/**
 * Verificaciones adicionales pedidas por el advisor:
 *   1) UNIQUE(module, name) en ir.model.data — crear duplicado y observar error.
 *   2) ¿Se puede crear ir.model.data PRIMERO (sin payment) con res_id=0 / placeholder?
 *      → si funciona, podría reemplazar el lock distribuido por UNIQUE constraint.
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
const exec = (uid, model, method, args, kwargs = {}) =>
  call(object, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs])

const PREFIX = 'TEST_AROUNDA_2026-05-12_'
const MODULE = '__aroundaplanet__'
const findings = {}

async function main() {
  const uid = await call(common, 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
  console.log(`[auth] uid=${uid}`)

  // Necesitamos un payment vivo para apuntar. Reuso uno cancelado del spike (8121).
  const refPaymentId = 8121

  // ---- VERIFY #1: UNIQUE(module, name) constraint ----
  console.log('\n[V1] Crear ir.model.data duplicado (mismo module+name+model) — esperamos UNIQUE error')
  const name1 = `${PREFIX}spike9-0b-VERIFY-unique`
  let firstId = null
  try {
    firstId = await exec(uid, 'ir.model.data', 'create', [{
      module: MODULE, name: name1, model: 'account.payment', res_id: refPaymentId, noupdate: true,
    }])
    console.log(`  primer create OK extId=${firstId}`)
  } catch (e) {
    console.log(`  primer create FALLO inesperado: ${e?.message?.slice(0, 150)}`)
  }
  let dupError = null
  try {
    const second = await exec(uid, 'ir.model.data', 'create', [{
      module: MODULE, name: name1, model: 'account.payment', res_id: refPaymentId, noupdate: true,
    }])
    console.log(`  ⚠️ segundo create NO fallo, id=${second}`)
    findings.uniqueConstraint = { exists: false, secondId: second }
  } catch (e) {
    dupError = e?.message?.slice(0, 400) ?? String(e)
    console.log(`  ✅ segundo create FALLO con: ${dupError.slice(0, 200)}`)
    findings.uniqueConstraint = { exists: true, error: dupError }
  }

  // Cleanup V1: renombrar el extId creado
  if (firstId) {
    const ts = Date.now()
    await exec(uid, 'ir.model.data', 'write', [[firstId], { name: `${name1}_CLEANED_${ts}` }])
  }

  // ---- VERIFY #2: Crear ir.model.data PRIMERO con res_id=0 (alternativa al lock) ----
  console.log('\n[V2] ¿Se puede crear ir.model.data con res_id=0 antes de existir el payment?')
  const name2 = `${PREFIX}spike9-0b-VERIFY-resid0`
  let v2Id = null
  let v2Err = null
  try {
    v2Id = await exec(uid, 'ir.model.data', 'create', [{
      module: MODULE, name: name2, model: 'account.payment', res_id: 0, noupdate: true,
    }])
    console.log(`  res_id=0 ACEPTADO, extId=${v2Id}`)
    findings.resIdZero = { accepted: true, extId: v2Id }
    // Probar update posterior con write(res_id = realPaymentId)
    try {
      await exec(uid, 'ir.model.data', 'write', [[v2Id], { res_id: refPaymentId }])
      console.log(`  write res_id=${refPaymentId} OK — patrón "ir.model.data primero" es viable`)
      findings.resIdZero.updatable = true
    } catch (eW) {
      console.log(`  write res_id fallo: ${eW?.message?.slice(0, 150)}`)
      findings.resIdZero.updatable = false
      findings.resIdZero.writeErr = eW?.message?.slice(0, 200)
    }
  } catch (e) {
    v2Err = e?.message?.slice(0, 400) ?? String(e)
    console.log(`  res_id=0 RECHAZADO: ${v2Err.slice(0, 200)}`)
    findings.resIdZero = { accepted: false, error: v2Err }
  }
  // Cleanup V2
  if (v2Id) {
    const ts = Date.now()
    await exec(uid, 'ir.model.data', 'write', [[v2Id], { name: `${name2}_CLEANED_${ts}` }])
  }

  // ---- VERIFY #3: res_id que NO existe (id arbitrario alto, ej 999999999) ----
  console.log('\n[V3] ¿Se valida que el res_id apunte a un account.payment existente?')
  const name3 = `${PREFIX}spike9-0b-VERIFY-fakeresid`
  let v3Id = null
  try {
    v3Id = await exec(uid, 'ir.model.data', 'create', [{
      module: MODULE, name: name3, model: 'account.payment', res_id: 999999999, noupdate: true,
    }])
    console.log(`  res_id=999999999 ACEPTADO sin validar FK, extId=${v3Id}`)
    findings.fakeResId = { accepted: true, extId: v3Id }
  } catch (e) {
    console.log(`  res_id=999999999 RECHAZADO: ${e?.message?.slice(0, 150)}`)
    findings.fakeResId = { accepted: false, error: e?.message?.slice(0, 200) }
  }
  if (v3Id) {
    const ts = Date.now()
    await exec(uid, 'ir.model.data', 'write', [[v3Id], { name: `${name3}_CLEANED_${ts}` }])
  }

  console.log('\n[summary]', JSON.stringify(findings, null, 2))
  writeFileSync(resolve(process.cwd(), 'scripts/audit-output/spike-9-0b-verify-constraints.json'),
    JSON.stringify({ finishedAt: new Date().toISOString(), findings }, null, 2))
}

main().catch(e => { console.error('[fail]', e?.message); process.exit(1) })
