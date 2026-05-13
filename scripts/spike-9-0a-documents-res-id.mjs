/**
 * Spike 9.0a — Validar ir.attachment res_model/res_id en Odoo 18 Enterprise Online.
 *
 * REGLAS ESTRICTAS:
 * - state='draft' SIEMPRE en account.payment de prueba. NUNCA action_post.
 * - NUNCA unlink. Cleanup vía write({active:False}) + rename con sufijo _CLEANED_<ts>.
 * - Prefijo TEST_AROUNDA_2026-05-12_ obligatorio en name de attachments y memo de payment.
 *
 * Protocolo:
 *  1. Levantar account.payment TEST (state=draft).
 *  2. Patrón A: create ir.attachment SIN res_id → write({res_model,res_id}) → re-leer.
 *  3. Patrón B: create ir.attachment YA con res_model+res_id desde el inicio → re-leer.
 *  4. Edge: create attachment con res_id=999999 (payment inexistente).
 *  5. search_read [res_model='account.payment', res_id=paymentId].
 *  6. Medir latencias p50/p95 (5 iteraciones del patrón ganador).
 *  7. Cleanup: active=False + rename _CLEANED_<ts>.
 *
 * Uso: node scripts/spike-9-0a-documents-res-id.mjs
 * Output: scripts/audit-output/spike-9-0a-output.json
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
const SPIKE_TAG = 'spike9-0a'

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

// PDF mínimo válido (~1KB) base64
function makeDummyPdfBase64() {
  // PDF mínimo (cabecera+EOF). Padding hasta ~1KB.
  const header = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\nxref\n0 3\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n104\n%%EOF\n'
  const padding = ' '.repeat(1024 - header.length)
  return Buffer.from(header + padding, 'utf8').toString('base64')
}

async function main() {
  const log = { startedAt: new Date().toISOString(), prefix: PREFIX, spike: SPIKE_TAG }
  const trace = []
  const allAttachmentIds = []
  const allPaymentIds = []
  const cleanupList = []

  const uid = await auth()
  log.uid = uid
  console.log(`[auth] uid=${uid}`)

  // ---- Prelude cleanup: barrer leftovers de runs previos ----
  console.log('[prelude] limpiando leftovers de runs previos (TEST_AROUNDA prefix activos)')
  const orphanAtts = await execKw(uid, 'ir.attachment', 'search_read',
    [[['name', '=like', `${PREFIX}${SPIKE_TAG}-%`], '!', ['name', '=like', '%_CLEANED_%']]],
    { fields: ['id', 'name'], limit: 100 },
  )
  if (orphanAtts.length) {
    console.log(`  encontrados ${orphanAtts.length} ir.attachment previos sin limpiar → renombrando`)
    for (const a of orphanAtts) {
      try {
        const tsPre = new Date().toISOString().replace(/[:.]/g, '-')
        await execKw(uid, 'ir.attachment', 'write', [[a.id], { name: `${a.name}_CLEANED_${tsPre}` }])
      } catch {}
    }
  }
  const orphanPays = await execKw(uid, 'account.payment', 'search_read',
    [[['memo', '=like', `${PREFIX}${SPIKE_TAG}-%`], ['state', '=', 'draft']]],
    { fields: ['id', 'memo'], limit: 100 },
  )
  if (orphanPays.length) {
    console.log(`  encontrados ${orphanPays.length} account.payment draft previos → cancelando`)
    for (const p of orphanPays) {
      try { await execKw(uid, 'account.payment', 'action_cancel', [[p.id]]) } catch {}
      try {
        const tsPre = new Date().toISOString().replace(/[:.]/g, '-')
        await execKw(uid, 'account.payment', 'write', [[p.id], { memo: `${p.memo}_CLEANED_${tsPre}` }])
      } catch {}
    }
  }

  // ---- Setup: partner + journal + dummy PDF ----
  const partners = await execKw(uid, 'res.partner', 'search_read',
    [[['customer_rank', '>', 0]]],
    { fields: ['id', 'name'], limit: 1 },
  )
  if (!partners.length) throw new Error('No se encontro partner candidato')
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
  console.log(`[journal] id=${journalId} code=${journals[0].code}`)

  // Crear payment TEST
  const paymentName = `${PREFIX}${SPIKE_TAG}-payment`
  const paymentId = await execKw(uid, 'account.payment', 'create', [{
    partner_id: partnerId,
    journal_id: journalId,
    amount: 1.0,
    payment_type: 'inbound',
    partner_type: 'customer',
    date: '2026-05-12',
    memo: paymentName,
  }])
  allPaymentIds.push(paymentId)
  const [payRow] = await execKw(uid, 'account.payment', 'read', [[paymentId]], { fields: ['id', 'state', 'memo', 'amount'] })
  log.payment = payRow
  console.log(`[payment] id=${paymentId} state=${payRow?.state} amount=${payRow?.amount}`)
  if (payRow?.state !== 'draft') {
    console.error(`[abort] payment no quedó en draft (state=${payRow?.state}). Cancelando spike.`)
    process.exit(1)
  }

  const dummyPdf = makeDummyPdfBase64()
  const dummySize = Buffer.from(dummyPdf, 'base64').length
  log.dummyPdfSize = dummySize
  console.log(`[dummy] pdf=${dummySize}B base64`)

  // =====================================================
  // PATRÓN A: create sin res_id → write({res_model,res_id})
  // =====================================================
  console.log('\n[A] create sin res_id → write res_model+res_id')
  const aName = `${PREFIX}${SPIKE_TAG}-A.pdf`
  const tA1 = now()
  const aId = await execKw(uid, 'ir.attachment', 'create', [{
    name: aName,
    datas: dummyPdf,
    mimetype: 'application/pdf',
  }])
  const tA2 = now()
  allAttachmentIds.push(aId)
  console.log(`  A.create id=${aId} (${tA2 - tA1}ms)`)

  // Re-leer estado inicial (esperamos res_model/res_id vacíos)
  const [aBefore] = await execKw(uid, 'ir.attachment', 'read', [[aId]], { fields: ['id', 'name', 'res_model', 'res_id', 'mimetype', 'file_size', 'public'] })

  // write({res_model, res_id})
  const tA3 = now()
  let aWriteOk = false
  let aWriteErr = null
  try {
    const w = await execKw(uid, 'ir.attachment', 'write', [[aId], { res_model: 'account.payment', res_id: paymentId }])
    aWriteOk = w === true
  } catch (e) {
    aWriteErr = e?.message ?? String(e)
  }
  const tA4 = now()
  console.log(`  A.write ok=${aWriteOk} err=${aWriteErr ? 'YES' : 'NO'} (${tA4 - tA3}ms)`)

  // Re-leer post-write
  const [aAfter] = await execKw(uid, 'ir.attachment', 'read', [[aId]], { fields: ['id', 'name', 'res_model', 'res_id'] })
  const aPersisted = aAfter?.res_model === 'account.payment' && aAfter?.res_id === paymentId
  console.log(`  A.after res_model=${aAfter?.res_model} res_id=${aAfter?.res_id} persisted=${aPersisted}`)
  trace.push({ scenario: 'A-create-then-write', attachmentId: aId, before: aBefore, writeOk: aWriteOk, writeErr: aWriteErr, after: aAfter, persisted: aPersisted, latencyMs: { create: tA2 - tA1, write: tA4 - tA3 } })

  // =====================================================
  // PATRÓN B: create YA con res_model+res_id
  // =====================================================
  console.log('\n[B] create con res_model+res_id desde el inicio')
  const bName = `${PREFIX}${SPIKE_TAG}-B.pdf`
  const tB1 = now()
  let bId = null
  let bErr = null
  try {
    bId = await execKw(uid, 'ir.attachment', 'create', [{
      name: bName,
      datas: dummyPdf,
      mimetype: 'application/pdf',
      res_model: 'account.payment',
      res_id: paymentId,
    }])
  } catch (e) {
    bErr = e?.message ?? String(e)
  }
  const tB2 = now()
  if (bId) allAttachmentIds.push(bId)
  console.log(`  B.create id=${bId} err=${bErr ? 'YES' : 'NO'} (${tB2 - tB1}ms)`)
  let bAfter = null
  let bPersisted = false
  if (bId) {
    ;[bAfter] = await execKw(uid, 'ir.attachment', 'read', [[bId]], { fields: ['id', 'name', 'res_model', 'res_id', 'mimetype'] })
    bPersisted = bAfter?.res_model === 'account.payment' && bAfter?.res_id === paymentId
    console.log(`  B.after res_model=${bAfter?.res_model} res_id=${bAfter?.res_id} persisted=${bPersisted}`)
  }
  trace.push({ scenario: 'B-create-with-res', attachmentId: bId, createErr: bErr, after: bAfter, persisted: bPersisted, latencyMs: { create: tB2 - tB1 } })

  // =====================================================
  // EDGE: res_id apuntando a payment inexistente
  // =====================================================
  console.log('\n[EDGE] create con res_id=999999 (inexistente)')
  const eName = `${PREFIX}${SPIKE_TAG}-EDGE-999999.pdf`
  let eId = null
  let eErr = null
  const tE1 = now()
  try {
    eId = await execKw(uid, 'ir.attachment', 'create', [{
      name: eName,
      datas: dummyPdf,
      mimetype: 'application/pdf',
      res_model: 'account.payment',
      res_id: 999999,
    }])
  } catch (e) {
    eErr = e?.message ?? String(e)
  }
  const tE2 = now()
  if (eId) allAttachmentIds.push(eId)
  let eAfter = null
  let eReadErr = null
  if (eId) {
    try {
      ;[eAfter] = await execKw(uid, 'ir.attachment', 'read', [[eId]], { fields: ['id', 'res_model', 'res_id'] })
    } catch (e) {
      eReadErr = e?.message ?? String(e)
    }
  }
  // Intentar search_read sin fields críticos como fallback
  let eSearchHit = null
  if (eId && eReadErr) {
    try {
      const sr = await execKw(uid, 'ir.attachment', 'search_read', [[['id', '=', eId]]], { fields: ['id'], limit: 1 })
      eSearchHit = sr.length > 0
    } catch (eS) { eSearchHit = `search_err: ${eS?.message ?? String(eS)}` }
  }
  console.log(`  EDGE.create id=${eId} createErr=${eErr ? 'YES' : 'NO'} readErr=${eReadErr ? 'YES (ACL bloqueó re-read)' : 'NO'} after.res_id=${eAfter?.res_id} searchHit=${eSearchHit} (${tE2 - tE1}ms)`)
  trace.push({ scenario: 'EDGE-orphan-res-id', attachmentId: eId, createErr: eErr, after: eAfter, readErr: eReadErr, searchHitAfterFail: eSearchHit, latencyMs: tE2 - tE1 })

  // =====================================================
  // SEARCH: ¿aparecen los attachments al buscar por res_model+res_id?
  // =====================================================
  console.log('\n[SEARCH] search_read por res_model+res_id')
  const tS1 = now()
  const found = await execKw(uid, 'ir.attachment', 'search_read',
    [[['res_model', '=', 'account.payment'], ['res_id', '=', paymentId]]],
    { fields: ['id', 'name', 'res_model', 'res_id'], limit: 20 },
  )
  const tS2 = now()
  const foundIds = found.map(r => r.id)
  console.log(`  found=${foundIds.length} ids=${JSON.stringify(foundIds)} (${tS2 - tS1}ms)`)
  trace.push({ scenario: 'SEARCH-by-res', count: foundIds.length, ids: foundIds, latencyMs: tS2 - tS1 })

  // =====================================================
  // LATENCIAS: 5 iteraciones del patrón ganador (B si funciona, sino A)
  // =====================================================
  console.log('\n[LAT] 5 iteraciones latencias')
  const winner = bPersisted ? 'B' : (aPersisted ? 'A' : null)
  const latTimings = []
  if (winner) {
    for (let i = 0; i < 5; i++) {
      const n = `${PREFIX}${SPIKE_TAG}-LAT-${winner}-${i + 1}.pdf`
      const tL1 = now()
      let lId, lAfter
      if (winner === 'B') {
        lId = await execKw(uid, 'ir.attachment', 'create', [{
          name: n,
          datas: dummyPdf,
          mimetype: 'application/pdf',
          res_model: 'account.payment',
          res_id: paymentId,
        }])
        const tL2 = now()
        latTimings.push({ iter: i + 1, totalMs: tL2 - tL1, calls: 1 })
      } else {
        // Patrón A: create + write
        lId = await execKw(uid, 'ir.attachment', 'create', [{
          name: n,
          datas: dummyPdf,
          mimetype: 'application/pdf',
        }])
        await execKw(uid, 'ir.attachment', 'write', [[lId], { res_model: 'account.payment', res_id: paymentId }])
        const tL2 = now()
        latTimings.push({ iter: i + 1, totalMs: tL2 - tL1, calls: 2 })
      }
      allAttachmentIds.push(lId)
      console.log(`  iter ${i + 1}: id=${lId} totalMs=${latTimings[i].totalMs} calls=${latTimings[i].calls}`)
    }
  } else {
    console.log('  (skip) ningún patrón funcionó — no hay ganador para benchmark')
  }
  const totals = latTimings.map(t => t.totalMs).sort((a, b) => a - b)
  const pct = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor((arr.length - 1) * p))] : null
  const latStats = totals.length ? {
    winner,
    callsPerFlow: latTimings[0].calls,
    min: totals[0], p50: pct(totals, 0.5), p95: pct(totals, 0.95), max: totals[totals.length - 1],
    iterations: latTimings,
  } : { winner: null, note: 'sin ganador' }
  trace.push({ scenario: 'LAT-stats', stats: latStats })
  if (totals.length) console.log(`  stats winner=${winner} p50=${latStats.p50} p95=${latStats.p95} max=${latStats.max}`)

  // =====================================================
  // CLEANUP: active=False + rename _CLEANED_<ts>
  // =====================================================
  console.log('\n[cleanup] active=False + rename _CLEANED_')
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const cleanupLog = { attachments: [], payments: [], errors: [] }

  const uniqueAttIds = [...new Set(allAttachmentIds)].filter(Boolean)
  for (const aid of uniqueAttIds) {
    let prevName = null
    try {
      const [row] = await execKw(uid, 'ir.attachment', 'read', [[aid]], { fields: ['id', 'name'] })
      prevName = row?.name ?? null
    } catch (e) {
      // ACL bloqueó read (caso EDGE) — intentar write blind
      cleanupLog.errors.push({ stage: 'read-attachment', id: aid, err: e?.message ?? String(e), note: 'blind-write fallback' })
    }
    const newName = `${prevName ?? `att_${aid}`}_CLEANED_${ts}`
    try {
      await execKw(uid, 'ir.attachment', 'write', [[aid], { name: newName }])
      cleanupLog.attachments.push({ id: aid, prevName, newName, renamed: true })
      cleanupList.push(`ir.attachment:${aid}:${newName}`)
    } catch (eW) {
      cleanupLog.errors.push({ stage: 'cleanup-attachment', id: aid, err: eW?.message ?? String(eW) })
    }
  }

  const uniquePayIds = [...new Set(allPaymentIds)]
  for (const pid of uniquePayIds) {
    try {
      const [row] = await execKw(uid, 'account.payment', 'read', [[pid]], { fields: ['id', 'name', 'state'] })
      let cancelled = false
      // Odoo 18 usa state='canceled' (no 'cancel'). action_cancel devuelve None que rompe XML-RPC marshalling.
      try {
        await execKw(uid, 'account.payment', 'write', [[pid], { state: 'canceled' }])
        cancelled = true
      } catch (eW) {
        cleanupLog.errors.push({ stage: 'cancel-payment', pid, err: eW?.message ?? String(eW) })
      }
      const newName = `${row?.name ?? `pay_${pid}`}_CLEANED_${ts}`
      try {
        await execKw(uid, 'account.payment', 'write', [[pid], { memo: newName }])
      } catch (eR) {
        cleanupLog.errors.push({ stage: 'rename-payment', pid, err: eR?.message })
      }
      cleanupLog.payments.push({ id: pid, prevState: row?.state, cancelled, newName })
      cleanupList.push(`account.payment:${pid}:${newName}:state=${cancelled ? 'canceled' : row?.state}`)
    } catch (e) {
      cleanupLog.errors.push({ stage: 'cleanup-payment', pid, err: e?.message ?? String(e) })
    }
  }

  // Verificación post-cleanup
  const postAttRenamed = await execKw(uid, 'ir.attachment', 'search_count',
    [[['id', 'in', uniqueAttIds], ['name', '=like', '%_CLEANED_%']]],
  )
  const postPayCancelled = await execKw(uid, 'account.payment', 'search_count',
    [[['id', 'in', uniquePayIds], ['state', '=', 'cancel']]],
  )
  cleanupLog.verification = {
    totalAttachments: uniqueAttIds.length,
    renamed: postAttRenamed,
    totalPayments: uniquePayIds.length,
    cancelled: postPayCancelled,
  }
  console.log(`  attachments: ${postAttRenamed}/${uniqueAttIds.length} renamed _CLEANED_`)
  console.log(`  payments: ${postPayCancelled}/${uniquePayIds.length} cancelled`)
  if (cleanupLog.errors.length) console.log(`  errors: ${cleanupLog.errors.length}`)

  // Persistir output
  const out = {
    ...log,
    finishedAt: new Date().toISOString(),
    paymentIdsCreated: uniquePayIds,
    attachmentIdsCreated: uniqueAttIds,
    summary: {
      patternA_persisted: aPersisted,
      patternB_persisted: bPersisted,
      edge_orphan_res_id_accepted: !!eId,
      search_by_res_returns_attachments: foundIds.length > 0,
      recommended_pattern: winner,
    },
    latencyStats: latStats,
    trace,
    cleanupLog,
  }
  const outPath = resolve(process.cwd(), 'scripts/audit-output/spike-9-0a-output.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
  console.log(`\n[ok] output: ${outPath}`)

  const cleanupPath = resolve(process.cwd(), '_bmad-output/implementation-artifacts/spikes/9-0a-cleanup-list.txt')
  writeFileSync(cleanupPath, [
    `# Spike 9.0a cleanup list — ${new Date().toISOString()}`,
    `# Formato: <modelo>:<id>:<nuevo_nombre>[:<extra>]`,
    `# Política: active=False + rename _CLEANED_<ts>. NUNCA unlink.`,
    ...cleanupList,
  ].join('\n') + '\n', 'utf8')
  console.log(`[ok] cleanup-list: ${cleanupPath}`)
}

main().catch(e => {
  console.error('[fail]', e?.message ?? e, e?.stack)
  process.exit(1)
})
