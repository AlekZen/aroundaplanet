/**
 * Spike 9.0b — Validar idempotencia 2-call create account.payment + ir.model.data.
 *
 * REGLAS ESTRICTAS (override del spec original):
 * - state='draft' SIEMPRE en account.payment. NUNCA action_post.
 * - NUNCA unlink. Cleanup vía write({state:'cancel'}) + write({active:False}) + rename con sufijo _CLEANED_<ts>.
 * - Prefijo TEST_AROUNDA_2026-05-12_ obligatorio en name de payments y en external_id name.
 * - module='__aroundaplanet__' (doble underscore convención Odoo para integraciones externas).
 *
 * Uso: node scripts/spike-9-0b-idempotencia.mjs
 * Output: scripts/audit-output/spike-9-0b-output.json
 */
import xmlrpc from 'xmlrpc'
import { writeFileSync, readFileSync } from 'fs'
import { resolve } from 'path'

// Cargar .env.local
try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const ODOO_URL = process.env.ODOO_URL
const ODOO_DB = process.env.ODOO_DB
const ODOO_USERNAME = process.env.ODOO_USERNAME
const ODOO_API_KEY = process.env.ODOO_API_KEY
if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_API_KEY) {
  console.error('[fail] faltan variables ODOO_*')
  process.exit(1)
}

const PREFIX = 'TEST_AROUNDA_2026-05-12_'
const EXTID_MODULE = '__aroundaplanet__'

const host = new URL(ODOO_URL).hostname
const mkClient = (p) => xmlrpc.createSecureClient({ host, port: 443, path: p })
const common = mkClient('/xmlrpc/2/common')
const object = mkClient('/xmlrpc/2/object')

function call(client, method, params, timeoutMs = 60000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`Timeout ${timeoutMs}ms en ${method}`)), timeoutMs)
    client.methodCall(method, params, (err, val) => {
      clearTimeout(t)
      if (err) rej(err)
      else res(val)
    })
  })
}

async function auth() {
  const uid = await call(common, 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
  if (!uid) throw new Error('auth fallo')
  return uid
}

async function execKw(uid, model, method, args, kwargs = {}, timeoutMs = 60000) {
  return call(object, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs], timeoutMs)
}

const now = () => Date.now()
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// --- Patrón 2-call idempotente ---
async function pushPaymentIdempotent(uid, { extIdName, paymentVals }) {
  const tStart = now()
  // Step 1: lookup ir.model.data
  const tLookupStart = now()
  const existing = await execKw(uid, 'ir.model.data', 'search_read',
    [[
      ['module', '=', EXTID_MODULE],
      ['name', '=', extIdName],
      ['model', '=', 'account.payment'],
    ]],
    { fields: ['res_id'], limit: 1 },
  )
  const tLookupEnd = now()
  if (Array.isArray(existing) && existing.length > 0) {
    return {
      isNew: false,
      odooPaymentId: existing[0].res_id,
      extIdRecordId: existing[0].id,
      timings: {
        lookupMs: tLookupEnd - tLookupStart,
        createPaymentMs: 0,
        createExtIdMs: 0,
        totalMs: now() - tStart,
        gapBetweenCallsMs: 0,
      },
    }
  }
  // Step 2a: create payment
  const tPayStart = now()
  const paymentId = await execKw(uid, 'account.payment', 'create', [paymentVals])
  const tPayEnd = now()
  // Step 2b: create ir.model.data
  const tExtStart = now()
  let extIdRecordId
  try {
    extIdRecordId = await execKw(uid, 'ir.model.data', 'create', [{
      module: EXTID_MODULE,
      name: extIdName,
      model: 'account.payment',
      res_id: paymentId,
      noupdate: true,
    }])
  } catch (e) {
    return {
      isNew: true,
      odooPaymentId: paymentId,
      extIdRecordId: null,
      orphan: true,
      error: e?.message ?? String(e),
      timings: {
        lookupMs: tLookupEnd - tLookupStart,
        createPaymentMs: tPayEnd - tPayStart,
        createExtIdMs: now() - tExtStart,
        totalMs: now() - tStart,
        gapBetweenCallsMs: tExtStart - tPayEnd,
      },
    }
  }
  const tExtEnd = now()
  return {
    isNew: true,
    odooPaymentId: paymentId,
    extIdRecordId,
    timings: {
      lookupMs: tLookupEnd - tLookupStart,
      createPaymentMs: tPayEnd - tPayStart,
      createExtIdMs: tExtEnd - tExtStart,
      totalMs: now() - tStart,
      gapBetweenCallsMs: tExtStart - tPayEnd,
    },
  }
}

async function main() {
  const log = { startedAt: new Date().toISOString(), prefix: PREFIX, module: EXTID_MODULE }
  const trace = []
  const allPaymentIds = []
  const allExtIdRecordIds = []

  const uid = await auth()
  log.uid = uid
  console.log(`[auth] uid=${uid}`)

  // Setup: partner + journal
  const partners = await execKw(uid, 'res.partner', 'search_read',
    [[['name', '=ilike', 'pagos aroundaplanet%']]],
    { fields: ['id', 'name'], limit: 5 },
  )
  if (!partners.length) {
    // Fallback: cualquier partner activo
    const fallback = await execKw(uid, 'res.partner', 'search_read',
      [[['customer_rank', '>', 0]]],
      { fields: ['id', 'name'], limit: 1 },
    )
    if (!fallback.length) throw new Error('No se encontro partner candidato')
    partners.push(fallback[0])
  }
  const partnerId = partners[0].id
  log.partner = { id: partnerId, name: partners[0].name }
  console.log(`[partner] id=${partnerId} name="${partners[0].name}"`)

  const journals = await execKw(uid, 'account.journal', 'search_read',
    [[['code', '=', 'BNK1']]],
    { fields: ['id', 'name', 'code', 'type'], limit: 1 },
  )
  if (!journals.length) throw new Error('No se encontro journal BNK1')
  const journalId = journals[0].id
  log.journal = journals[0]
  console.log(`[journal] id=${journalId} name="${journals[0].name}" code=${journals[0].code} type=${journals[0].type}`)

  const baseVals = {
    partner_id: partnerId,
    journal_id: journalId,
    amount: 1.0,
    payment_type: 'inbound',
    partner_type: 'customer',
    date: '2026-05-12',
  }
  // Odoo 18 account.payment no tiene 'memo'; usamos solo 'memo' como referencia user-facing.
  // 'name' lo asigna Odoo via secuencia al post; en draft acepta o ignora segun version.

  // ---- E1: Happy path ----
  console.log('\n[E1] Happy path')
  const e1Name = `${PREFIX}spike9-0b-pago1`
  const e1ExtId = `payment_${e1Name}`
  const e1 = await pushPaymentIdempotent(uid, {
    extIdName: e1ExtId,
    paymentVals: { ...baseVals, name: e1Name, memo: e1Name},
  })
  trace.push({ scenario: 'E1', extIdName: e1ExtId, result: e1 })
  if (e1.odooPaymentId) allPaymentIds.push(e1.odooPaymentId)
  if (e1.extIdRecordId) allExtIdRecordIds.push(e1.extIdRecordId)
  console.log(`  paymentId=${e1.odooPaymentId} extIdRecordId=${e1.extIdRecordId} totalMs=${e1.timings.totalMs} gap=${e1.timings.gapBetweenCallsMs}ms`)

  // Verificar persistencia
  const e1Verify = await execKw(uid, 'ir.model.data', 'search_read',
    [[['module', '=', EXTID_MODULE], ['name', '=', e1ExtId]]],
    { fields: ['res_id', 'model'], limit: 1 },
  )
  const e1ReadPay = await execKw(uid, 'account.payment', 'read', [[e1.odooPaymentId]], { fields: ['name', 'state', 'amount', 'partner_id', 'journal_id'] })
  trace.push({ scenario: 'E1-verify', extIdRow: e1Verify[0], paymentRow: e1ReadPay[0] })
  console.log(`  verify: extId.res_id=${e1Verify[0]?.res_id} match=${e1Verify[0]?.res_id === e1.odooPaymentId} payment.state=${e1ReadPay[0]?.state}`)

  // ---- E2: Re-ejecución idempotente (mismo extId 2 veces mas) ----
  console.log('\n[E2] Re-ejecucion idempotente x2')
  const e2a = await pushPaymentIdempotent(uid, {
    extIdName: e1ExtId,
    paymentVals: { ...baseVals, name: e1Name + '_should_not_create', memo: e1Name},
  })
  const e2b = await pushPaymentIdempotent(uid, {
    extIdName: e1ExtId,
    paymentVals: { ...baseVals, name: e1Name + '_should_not_create_2', memo: e1Name},
  })
  trace.push({ scenario: 'E2-run1', result: e2a })
  trace.push({ scenario: 'E2-run2', result: e2b })
  const e2Count = await execKw(uid, 'account.payment', 'search_count',
    [[['memo', '=', e1Name]]],
  )
  trace.push({ scenario: 'E2-count', countPayments: e2Count })
  console.log(`  run2.isNew=${e2a.isNew} run3.isNew=${e2b.isNew} samePaymentId=${e2a.odooPaymentId === e1.odooPaymentId && e2b.odooPaymentId === e1.odooPaymentId} search_count(memo)=${e2Count}`)

  // ---- E3: Race condition (Promise.all 2 ejecuciones nuevo extId) ----
  console.log('\n[E3] Race condition Promise.all')
  const e3Name = `${PREFIX}spike9-0b-pago2`
  const e3ExtId = `payment_${e3Name}`
  const e3Vals = { ...baseVals, name: e3Name, memo: e3Name}
  const [e3a, e3b] = await Promise.allSettled([
    pushPaymentIdempotent(uid, { extIdName: e3ExtId, paymentVals: e3Vals }),
    pushPaymentIdempotent(uid, { extIdName: e3ExtId, paymentVals: e3Vals }),
  ])
  trace.push({ scenario: 'E3-a', result: e3a })
  trace.push({ scenario: 'E3-b', result: e3b })
  for (const r of [e3a, e3b]) {
    if (r.status === 'fulfilled') {
      if (r.value.odooPaymentId) allPaymentIds.push(r.value.odooPaymentId)
      if (r.value.extIdRecordId) allExtIdRecordIds.push(r.value.extIdRecordId)
    }
  }
  const e3Count = await execKw(uid, 'account.payment', 'search_count',
    [[['memo', '=', e3Name]]],
  )
  const e3ExtCount = await execKw(uid, 'ir.model.data', 'search_count',
    [[['module', '=', EXTID_MODULE], ['name', '=', e3ExtId]]],
  )
  trace.push({ scenario: 'E3-count', countPayments: e3Count, countExtId: e3ExtCount })
  console.log(`  a.status=${e3a.status} b.status=${e3b.status} search_count(payments)=${e3Count} search_count(extId)=${e3ExtCount}`)
  if (e3a.status === 'fulfilled') console.log(`    a: paymentId=${e3a.value.odooPaymentId} isNew=${e3a.value.isNew} orphan=${!!e3a.value.orphan}`)
  if (e3b.status === 'fulfilled') console.log(`    b: paymentId=${e3b.value.odooPaymentId} isNew=${e3b.value.isNew} orphan=${!!e3b.value.orphan}`)
  if (e3a.status === 'rejected') console.log(`    a error: ${e3a.reason?.message}`)
  if (e3b.status === 'rejected') console.log(`    b error: ${e3b.reason?.message}`)

  // ---- E4: Fallo 2a call (model invalido) ----
  console.log('\n[E4] Fallo 2a call (forzado)')
  const e4Name = `${PREFIX}spike9-0b-pago3-orphan`
  const e4ExtId = `payment_${e4Name}`
  const e4Vals = { ...baseVals, name: e4Name, memo: e4Name}
  const tE4Start = now()
  const e4PayId = await execKw(uid, 'account.payment', 'create', [e4Vals])
  allPaymentIds.push(e4PayId)
  let e4Err = null
  try {
    await execKw(uid, 'ir.model.data', 'create', [{
      module: EXTID_MODULE,
      name: e4ExtId,
      model: 'INVALID.model.does.not.exist',
      res_id: e4PayId,
      noupdate: true,
    }])
  } catch (e) {
    e4Err = e?.message ?? String(e)
  }
  // Re-ejecucion: NO debe encontrar extId, intentaria duplicar
  const e4Retry = await pushPaymentIdempotent(uid, {
    extIdName: e4ExtId,
    paymentVals: { ...e4Vals, name: e4Name + '_retry', memo: e4Name},
  })
  if (e4Retry.odooPaymentId) allPaymentIds.push(e4Retry.odooPaymentId)
  if (e4Retry.extIdRecordId) allExtIdRecordIds.push(e4Retry.extIdRecordId)
  const e4DupCount = await execKw(uid, 'account.payment', 'search_count',
    [[['memo', '=', e4Name]]],
  )
  trace.push({ scenario: 'E4', firstPaymentId: e4PayId, createExtIdError: e4Err, retry: e4Retry, dupCount: e4DupCount, totalMs: now() - tE4Start })
  console.log(`  orphan payment=${e4PayId} createExtId err=${e4Err ? 'YES' : 'NO'}`)
  console.log(`  retry: paymentId=${e4Retry.odooPaymentId} isNew=${e4Retry.isNew} dup_search_count=${e4DupCount}`)

  // ---- E5: 5 happy-paths consecutivos para latencias ----
  console.log('\n[E5] 5 happy-paths consecutivos')
  const e5Timings = []
  for (let i = 0; i < 5; i++) {
    const name = `${PREFIX}spike9-0b-pago-e5-${i + 1}`
    const extId = `payment_${name}`
    const r = await pushPaymentIdempotent(uid, {
      extIdName: extId,
      paymentVals: { ...baseVals, name, memo: name},
    })
    if (r.odooPaymentId) allPaymentIds.push(r.odooPaymentId)
    if (r.extIdRecordId) allExtIdRecordIds.push(r.extIdRecordId)
    e5Timings.push(r.timings)
    console.log(`  iter ${i + 1}: paymentId=${r.odooPaymentId} totalMs=${r.timings.totalMs} gap=${r.timings.gapBetweenCallsMs}`)
  }
  const totals = e5Timings.map(t => t.totalMs).sort((a, b) => a - b)
  const gaps = e5Timings.map(t => t.gapBetweenCallsMs).sort((a, b) => a - b)
  const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor((arr.length - 1) * p))]
  const stats = {
    totalMs: { min: totals[0], p50: pct(totals, 0.5), p95: pct(totals, 0.95), max: totals[totals.length - 1] },
    gapBetweenCallsMs: { min: gaps[0], p50: pct(gaps, 0.5), p95: pct(gaps, 0.95), max: gaps[gaps.length - 1] },
    iterations: e5Timings,
  }
  trace.push({ scenario: 'E5-stats', stats })
  console.log(`  stats totalMs p50=${stats.totalMs.p50} p95=${stats.totalMs.p95} max=${stats.totalMs.max}`)
  console.log(`  stats gap p50=${stats.gapBetweenCallsMs.p50} p95=${stats.gapBetweenCallsMs.p95}`)

  // ---- CLEANUP ----
  console.log('\n[cleanup] cancel + active=False + rename _CLEANED_')
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const cleanupLog = { payments: [], extIds: [], errors: [] }

  // 1) Cancel payments
  const uniquePayIds = [...new Set(allPaymentIds)]
  for (const pid of uniquePayIds) {
    try {
      // Leer state actual
      const [row] = await execKw(uid, 'account.payment', 'read', [[pid]], { fields: ['id', 'name', 'state'] })
      // Cancelar via action_cancel cuando state es draft o posted; con draft basta write state='cancel'
      let cancelled = false
      try {
        await execKw(uid, 'account.payment', 'action_cancel', [[pid]])
        cancelled = true
      } catch (eCancel) {
        // Fallback: write directo
        try {
          await execKw(uid, 'account.payment', 'write', [[pid], { state: 'cancel' }])
          cancelled = true
        } catch (eWrite) {
          cleanupLog.errors.push({ stage: 'cancel-payment', pid, errAction: eCancel?.message, errWrite: eWrite?.message })
        }
      }
      // Rename
      const newName = `${row?.name ?? `pay_${pid}`}_CLEANED_${ts}`
      try {
        await execKw(uid, 'account.payment', 'write', [[pid], { name: newName, memo: newName }])
      } catch (eRename) {
        cleanupLog.errors.push({ stage: 'rename-payment', pid, err: eRename?.message })
      }
      cleanupLog.payments.push({ id: pid, prevState: row?.state, cancelled, newName })
    } catch (e) {
      cleanupLog.errors.push({ stage: 'cleanup-payment', pid, err: e?.message ?? String(e) })
    }
  }

  // 2) Desactivar ir.model.data (active=False) — NUNCA unlink
  const uniqueExtIds = [...new Set(allExtIdRecordIds)]
  for (const eid of uniqueExtIds) {
    try {
      // ir.model.data NO tiene campo active estandar. Renombrar como marca de cleanup.
      // Estrategia: write name -> '<old>_CLEANED_<ts>' para liberar el UNIQUE y marcar
      const [row] = await execKw(uid, 'ir.model.data', 'read', [[eid]], { fields: ['id', 'name', 'module', 'model', 'res_id'] })
      const newName = `${row?.name ?? `extid_${eid}`}_CLEANED_${ts}`
      try {
        await execKw(uid, 'ir.model.data', 'write', [[eid], { name: newName }])
        cleanupLog.extIds.push({ id: eid, prevName: row?.name, newName, action: 'renamed' })
      } catch (eW) {
        cleanupLog.errors.push({ stage: 'rename-extid', eid, err: eW?.message })
      }
    } catch (e) {
      cleanupLog.errors.push({ stage: 'cleanup-extid', eid, err: e?.message ?? String(e) })
    }
  }

  // 3) Verificacion post-cleanup
  const postPayCancelled = await execKw(uid, 'account.payment', 'search_count',
    [[['id', 'in', uniquePayIds], ['state', '=', 'cancel']]],
  )
  const postPayNamed = await execKw(uid, 'account.payment', 'search_count',
    [[['id', 'in', uniquePayIds], ['name', 'like', '_CLEANED_%']]],
  )
  const postExtCleaned = await execKw(uid, 'ir.model.data', 'search_count',
    [[['id', 'in', uniqueExtIds], ['name', 'like', '_CLEANED_%']]],
  )
  cleanupLog.verification = {
    totalPayments: uniquePayIds.length,
    cancelled: postPayCancelled,
    renamed: postPayNamed,
    totalExtIds: uniqueExtIds.length,
    extIdsRenamed: postExtCleaned,
  }
  console.log(`  payments: ${postPayCancelled}/${uniquePayIds.length} cancelled, ${postPayNamed}/${uniquePayIds.length} renamed`)
  console.log(`  ir.model.data: ${postExtCleaned}/${uniqueExtIds.length} renamed`)
  if (cleanupLog.errors.length) console.log(`  errors: ${cleanupLog.errors.length}`)

  // Persistir
  const out = {
    ...log,
    finishedAt: new Date().toISOString(),
    paymentIdsCreated: uniquePayIds,
    extIdRecordIdsCreated: uniqueExtIds,
    e5Stats: stats,
    trace,
    cleanupLog,
  }
  const outPath = resolve(process.cwd(), 'scripts/audit-output/spike-9-0b-output.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
  console.log(`\n[ok] ${outPath}`)
}

main().catch(e => {
  console.error('[fail]', e?.message ?? e, e?.stack)
  process.exit(1)
})
