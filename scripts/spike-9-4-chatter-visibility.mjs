/**
 * Spike 9.4 — Chatter visibility
 *
 * Valida si documents.document con res_model='account.payment' + res_id + tag_ids
 * hace que el ir.attachment subyacente herede esos campos (chatter del payment lo muestra).
 *
 * REGLAS:
 * - NUNCA unlink. Cleanup vía rename _CLEANED_<ts> y state=canceled.
 * - Prefijo TEST_AROUNDA_9-4-chatter_ obligatorio.
 * - PROD. Cuidado.
 *
 * Pasos:
 *  1. Crear account.payment draft
 *  2. Crear documents.document con res_model=account.payment + res_id + tag_ids en 1 call
 *  3. Re-read documents.document
 *  4. search_read ir.attachment por (res_model=account.payment, res_id=paymentId)
 *  5. read ir.attachment subyacente (via attachment_id)
 *  6. Si ir.attachment no tiene res_model=account.payment → write mitigación
 *  7. Cleanup
 *
 * Uso: node scripts/spike-9-4-chatter-visibility.mjs
 * Output: scripts/audit-output/9-4-chatter-visibility.json
 */
import xmlrpc from 'xmlrpc'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// --- cargar .env.local ---
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
  console.error('[FAIL] Faltan variables ODOO_*')
  process.exit(1)
}

const TS = Date.now()
const PREFIX = `TEST_AROUNDA_9-4-chatter_${TS}`
const TAG_ID = 47

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
  if (!uid || uid === false) throw new Error('Auth fallida')
  return uid
}

async function execKw(uid, model, method, args, kwargs = {}, timeoutMs = 60000) {
  return call(object, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs], timeoutMs)
}

function makeDummyPdfBase64() {
  const header = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\nxref\n0 3\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n104\n%%EOF\n'
  const padding = ' '.repeat(Math.max(0, 1024 - header.length))
  return Buffer.from(header + padding, 'utf8').toString('base64')
}

const results = {
  timestamp: new Date().toISOString(),
  tenant: ODOO_URL,
  tagId: TAG_ID,
  prefix: PREFIX,
  steps: {},
  cleanup: [],
  cleanupLog: [],
  verdict: {},
}

async function main() {
  console.log('[spike-9-4-chatter] Iniciando...')
  const uid = await auth()
  console.log(`[auth] uid=${uid}`)

  const dummyPdf = makeDummyPdfBase64()

  // ============================================================
  // PASO 1 — Crear account.payment en draft
  // ============================================================
  console.log('\n[P1] Crear account.payment draft...')
  let paymentId

  // Buscar journal bank (journal_id=13 BNK1 preferido)
  let journalId = 13
  try {
    const jCheck = await execKw(uid, 'account.journal', 'read', [[13], ['id', 'name', 'type']])
    if (!jCheck || !jCheck[0] || jCheck[0].type !== 'bank') {
      const journals = await execKw(uid, 'account.journal', 'search_read',
        [[['type', '=', 'bank']]],
        { fields: ['id', 'name'], limit: 1 }
      )
      journalId = journals[0]?.id ?? 13
    }
    console.log(`[P1] journal_id=${journalId}`)
  } catch {
    // fallback a 13
  }

  // Buscar partner test
  let partnerId = 1
  try {
    const partners = await execKw(uid, 'res.partner', 'search_read',
      [[['name', 'ilike', 'test']]],
      { fields: ['id', 'name'], limit: 1 }
    )
    if (partners.length > 0) partnerId = partners[0].id
    console.log(`[P1] partner_id=${partnerId}`)
  } catch {}

  paymentId = await execKw(uid, 'account.payment', 'create', [{
    partner_id: partnerId,
    partner_type: 'customer',
    payment_type: 'inbound',
    journal_id: journalId,
    amount: 1.0,
    memo: `${PREFIX}`,
  }])
  results.cleanup.push({ model: 'account.payment', id: paymentId, action: 'cancel' })
  results.steps.step1_payment = { paymentId }
  console.log(`[P1] account.payment id=${paymentId}`)

  // ============================================================
  // PASO 2 — Crear documents.document con res_model + res_id + tag_ids en 1 call
  // ============================================================
  console.log('\n[P2] Crear documents.document...')
  const s2 = { docId: null, success: false, error: null }
  results.steps.step2_createDoc = s2

  // Buscar folder disponible (obligatorio en algunos tenants)
  let folderId = null
  try {
    const folders = await execKw(uid, 'documents.folder', 'search_read',
      [[]],
      { fields: ['id', 'name'], limit: 3 }
    )
    if (folders.length > 0) {
      folderId = folders[0].id
      console.log(`[P2] folder_id=${folderId} name="${folders[0].name}"`)
    }
  } catch (e) {
    console.warn(`[P2] No se pudo obtener folder: ${e.message}`)
  }

  const createPayload = {
    name: `${PREFIX}.pdf`,
    datas: dummyPdf,
    mimetype: 'application/pdf',
    res_model: 'account.payment',
    res_id: paymentId,
    tag_ids: [[6, 0, [TAG_ID]]],
  }
  if (folderId) createPayload.folder_id = folderId

  try {
    const docId = await execKw(uid, 'documents.document', 'create', [createPayload])
    s2.docId = docId
    s2.success = true
    s2.createPayload = { ...createPayload, datas: '<base64 omitted>' }
    results.cleanup.push({ model: 'documents.document', id: docId, action: 'rename' })
    console.log(`[P2] documents.document id=${docId}`)
  } catch (e) {
    s2.error = e.message
    console.error(`[P2] ERROR: ${e.message}`)
    // Sin doc creado no hay sentido seguir
    await runCleanup(uid)
    saveResults()
    process.exit(1)
  }

  const docId = s2.docId

  // ============================================================
  // PASO 3 — Re-read documents.document
  // ============================================================
  console.log('\n[P3] Re-read documents.document...')
  const s3 = { reread: null, error: null }
  results.steps.step3_rereadDoc = s3

  try {
    const docFields = ['id', 'name', 'res_model', 'res_id', 'tag_ids', 'attachment_id']
    const docRead = await execKw(uid, 'documents.document', 'read', [[docId], docFields])
    s3.reread = docRead[0] || null
    console.log(`[P3] documents.document:`, JSON.stringify(s3.reread))
  } catch (e) {
    s3.error = e.message
    console.error(`[P3] ERROR: ${e.message}`)
  }

  // ============================================================
  // PASO 4 — search_read ir.attachment por res_model=account.payment + res_id=paymentId
  // ============================================================
  console.log('\n[P4] search_read ir.attachment por (res_model=account.payment, res_id=paymentId)...')
  const s4 = { attachments: [], foundInChatter: false, error: null }
  results.steps.step4_irAttachmentSearch = s4

  try {
    const atts = await execKw(uid, 'ir.attachment', 'search_read',
      [[['res_model', '=', 'account.payment'], ['res_id', '=', paymentId]]],
      { fields: ['id', 'name', 'res_model', 'res_id', 'mimetype', 'file_size'], limit: 5 }
    )
    s4.attachments = atts
    s4.foundInChatter = atts.length > 0
    console.log(`[P4] ir.attachment encontrados en chatter del payment: ${atts.length}`)
    atts.forEach(a => console.log(`  -> id=${a.id} name="${a.name}" res_model=${a.res_model} res_id=${a.res_id}`))
  } catch (e) {
    s4.error = e.message
    console.error(`[P4] ERROR: ${e.message}`)
  }

  // ============================================================
  // PASO 5 — Leer ir.attachment subyacente via attachment_id del documents.document
  // ============================================================
  console.log('\n[P5] Leer ir.attachment subyacente via attachment_id...')
  const s5 = { attachmentId: null, irAttachmentRead: null, resModelIsPayment: false, error: null }
  results.steps.step5_underlyingAttachment = s5

  const attRef = s3.reread?.attachment_id
  let underlyingAttId = null

  if (attRef && Array.isArray(attRef) && attRef[0]) {
    underlyingAttId = attRef[0]
    s5.attachmentId = underlyingAttId
    try {
      const irRead = await execKw(uid, 'ir.attachment', 'read',
        [[underlyingAttId], ['id', 'name', 'res_model', 'res_id', 'mimetype']]
      )
      s5.irAttachmentRead = irRead[0] || null
      s5.resModelIsPayment = irRead[0]?.res_model === 'account.payment'
      console.log(`[P5] ir.attachment id=${underlyingAttId}:`, JSON.stringify(s5.irAttachmentRead))
      console.log(`[P5] res_model es account.payment: ${s5.resModelIsPayment}`)
    } catch (e) {
      s5.error = e.message
      console.error(`[P5] ERROR: ${e.message}`)
    }
  } else if (typeof attRef === 'number') {
    // a veces attachment_id viene como integer
    underlyingAttId = attRef
    s5.attachmentId = underlyingAttId
    try {
      const irRead = await execKw(uid, 'ir.attachment', 'read',
        [[underlyingAttId], ['id', 'name', 'res_model', 'res_id', 'mimetype']]
      )
      s5.irAttachmentRead = irRead[0] || null
      s5.resModelIsPayment = irRead[0]?.res_model === 'account.payment'
      console.log(`[P5] ir.attachment id=${underlyingAttId}:`, JSON.stringify(s5.irAttachmentRead))
    } catch (e) {
      s5.error = e.message
    }
  } else {
    console.warn('[P5] documents.document no tiene attachment_id — campo ausente o null')
    s5.error = 'attachment_id no disponible en documents.document'
  }

  // ============================================================
  // PASO 6 — Si ir.attachment NO tiene res_model=account.payment, intentar write mitigación
  // ============================================================
  const s6 = { attempted: false, writeSuccess: false, afterWriteRead: null, foundInChatterAfterWrite: false, error: null }
  results.steps.step6_mitigation = s6

  const needsMitigation = underlyingAttId && !s5.resModelIsPayment
  if (needsMitigation) {
    console.log(`\n[P6] ir.attachment subyacente no apunta al payment. Intentando write mitigación...`)
    s6.attempted = true
    try {
      await execKw(uid, 'ir.attachment', 'write',
        [[underlyingAttId], { res_model: 'account.payment', res_id: paymentId }]
      )
      s6.writeSuccess = true
      console.log(`[P6] write exitoso`)

      // Re-verificar
      const afterWrite = await execKw(uid, 'ir.attachment', 'read',
        [[underlyingAttId], ['id', 'name', 'res_model', 'res_id']]
      )
      s6.afterWriteRead = afterWrite[0] || null
      console.log(`[P6] después del write:`, JSON.stringify(s6.afterWriteRead))

      // Repetir búsqueda en chatter
      const atts2 = await execKw(uid, 'ir.attachment', 'search_read',
        [[['res_model', '=', 'account.payment'], ['res_id', '=', paymentId]]],
        { fields: ['id', 'name', 'res_model', 'res_id'], limit: 5 }
      )
      s6.foundInChatterAfterWrite = atts2.length > 0
      s6.attachmentsAfterWrite = atts2
      console.log(`[P6] ir.attachment en chatter después de write: ${atts2.length}`)
    } catch (e) {
      s6.writeSuccess = false
      s6.error = e.message
      console.error(`[P6] ERROR write mitigación: ${e.message}`)
    }
  } else if (!underlyingAttId) {
    console.log('\n[P6] Sin attachment_id — skip mitigación')
  } else {
    console.log('\n[P6] ir.attachment ya tiene res_model=account.payment — no necesita mitigación')
    s6.attempted = false
  }

  // ============================================================
  // CLEANUP
  // ============================================================
  await runCleanup(uid)

  // ============================================================
  // VEREDICTO
  // ============================================================
  const propagaPorDefault = s4.foundInChatter || s5.resModelIsPayment
  const mitigacionFunciona = needsMitigation ? (s6.writeSuccess && s6.foundInChatterAfterWrite) : null
  const tagPersiste = (() => {
    const tags = s3.reread?.tag_ids
    return Array.isArray(tags) && tags.includes(TAG_ID)
  })()

  let camino
  let recomendacion
  if (propagaPorDefault && tagPersiste) {
    camino = 'B1'
    recomendacion = 'Camino B1 (1 call): documents.document con res_model=payment + tag_ids. El ir.attachment subyacente hereda res_model=account.payment. Visible en chatter y en Documents por tag.'
  } else if (!propagaPorDefault && mitigacionFunciona && tagPersiste) {
    camino = 'B2'
    recomendacion = 'Camino B2 (2 calls): documents.document create + ir.attachment write(res_model=account.payment). Ambos funcionan.'
  } else if (!propagaPorDefault && mitigacionFunciona === false) {
    camino = 'C'
    recomendacion = 'Camino C (degraded): La mitigación write sobre ir.attachment falló (ACL u otro error). Usar ir.attachment Patrón B directo sin tag — visible en chatter del payment pero no en Documents por tag.'
  } else if (!propagaPorDefault && !needsMitigation) {
    // attachment_id no disponible en documents.document
    camino = 'C'
    recomendacion = 'Camino C (degraded): documents.document no expone attachment_id vía XML-RPC — no se puede hacer mitigación. Usar ir.attachment Patrón B directo.'
  } else {
    camino = 'INDETERMINATE'
    recomendacion = 'Revisar steps manualmente — resultado no concluyente.'
  }

  results.verdict = {
    Q1_documentsDocPropagaResModelAlIrAttachment: propagaPorDefault,
    Q2_writeIrAttachmentCambiaResModelSinError: needsMitigation ? s6.writeSuccess : 'N/A (no necesario)',
    Q2_writeHaceVisibleEnChatter: needsMitigation ? s6.foundInChatterAfterWrite : 'N/A',
    Q3_tagPersiste: tagPersiste,
    caminoRecomendado: camino,
    recomendacion,
    summary: {
      step4_foundInChatterSinMitigacion: s4.foundInChatter,
      step5_irAttResModel: s5.irAttachmentRead?.res_model ?? null,
      step6_mitigacionAttempted: s6.attempted,
      step6_writeSuccess: s6.writeSuccess,
      step6_foundAfterWrite: s6.foundInChatterAfterWrite,
    },
  }

  console.log('\n[VEREDICTO]')
  console.log(`  Q1 documents.document propaga res_model al ir.attachment: ${propagaPorDefault}`)
  if (needsMitigation !== undefined && needsMitigation !== null) {
    console.log(`  Q2 write mitigacion funciona sin ACL error: ${s6.writeSuccess}`)
    console.log(`  Q2 visible en chatter post-write: ${s6.foundInChatterAfterWrite}`)
  }
  console.log(`  Q3 tag persiste en documents.document: ${tagPersiste}`)
  console.log(`  CAMINO RECOMENDADO: ${camino}`)
  console.log(`  ${recomendacion}`)

  saveResults()
}

async function runCleanup(uid) {
  console.log('\n[cleanup] Ejecutando cleanup...')
  const cleanupTs = Date.now()

  for (const item of results.cleanup) {
    try {
      if (item.action === 'rename') {
        const newName = `_CLEANED_${cleanupTs}_${item.model.replace('.', '_')}_${item.id}`
        await execKw(uid, item.model, 'write', [[item.id], { name: newName }])
        results.cleanupLog.push({ ...item, done: true, cleanedName: newName })
        console.log(`[cleanup] renamed ${item.model} id=${item.id} -> ${newName}`)
      } else if (item.action === 'cancel') {
        // account.payment: intentar state=cancel primero, luego canceled
        let canceled = false
        try {
          await execKw(uid, item.model, 'write', [[item.id], { state: 'cancel' }])
          canceled = true
        } catch {}
        if (!canceled) {
          try {
            await execKw(uid, item.model, 'write', [[item.id], { state: 'canceled' }])
            canceled = true
          } catch {}
        }
        // También renombrar para que quede identificable
        try {
          await execKw(uid, item.model, 'write', [[item.id], { ref: `_CLEANED_${cleanupTs}_${item.id}` }])
        } catch {}
        results.cleanupLog.push({ ...item, done: canceled })
        console.log(`[cleanup] cancel ${item.model} id=${item.id}: ${canceled ? 'OK' : 'FAIL (puede requerir accion manual)'}`)
      }
    } catch (e) {
      results.cleanupLog.push({ ...item, done: false, error: e.message })
      console.error(`[cleanup] ERROR ${item.model} id=${item.id}: ${e.message}`)
    }
  }
}

function saveResults() {
  const outDir = resolve(__dirname, 'audit-output')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, '9-4-chatter-visibility.json')
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8')
  console.log(`\n[done] Output en ${outPath}`)
}

main().catch(e => {
  console.error('[FATAL]', e)
  process.exit(1)
})
