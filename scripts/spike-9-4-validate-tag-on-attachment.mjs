/**
 * Spike 9.4 — Validar si ir.attachment / documents.document aceptan tag_ids
 *              apuntando a documents.tag id=47 (aroundaplanet_comprobante).
 *
 * REGLAS ESTRICTAS:
 * - NUNCA unlink. Cleanup vía rename a _CLEANED_<ts>.
 * - Prefijo TEST_AROUNDA_9-4-tag-validation_ obligatorio en nombres.
 * - PROD. Cuidado.
 *
 * Escenarios:
 *   1. ir.attachment con tag_ids -> ¿acepta campo? ¿persiste tag?
 *   2. documents.document wrapper con tag_ids -> ¿funciona? ¿crea ir.attachment subyacente?
 *   3. search_read documents.document filtrando por tag_ids=[47] -> ¿aparece el doc creado?
 *
 * Uso: node scripts/spike-9-4-validate-tag-on-attachment.mjs
 * Output: scripts/audit-output/9-4-tag-validation.json
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
const PREFIX = `TEST_AROUNDA_9-4-tag-validation_${TS}`
const TAG_ID = 47
// payments cancelados del spike 9.0a — cualquiera sirve como res_id de prueba
const CANDIDATE_PAYMENT_IDS = [8131, 8132]

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
  paymentIdUsed: null,
  scenarios: {},
  cleanup: [],
  verdict: {},
}

async function main() {
  console.log('[spike-9-4] Iniciando...')
  const uid = await auth()
  console.log(`[auth] uid=${uid}`)

  const dummyPdf = makeDummyPdfBase64()

  // --- Elegir payment de prueba ---
  let paymentId = null
  for (const pid of CANDIDATE_PAYMENT_IDS) {
    try {
      const found = await execKw(uid, 'account.payment', 'read', [[pid], ['id', 'name', 'state']])
      if (found && found.length > 0) {
        paymentId = pid
        console.log(`[payment] Usando account.payment id=${pid} state=${found[0].state}`)
        break
      }
    } catch (e) {
      console.warn(`[payment] id=${pid} no disponible: ${e.message}`)
    }
  }
  if (!paymentId) {
    console.log('[payment] Payments candidatos no encontrados. Creando uno nuevo en state=draft...')
    // Buscar partner test existente
    const partners = await execKw(uid, 'res.partner', 'search_read',
      [[['name', 'ilike', 'test']]],
      { fields: ['id', 'name'], limit: 1 }
    )
    const partnerId = partners.length > 0 ? partners[0].id : 1
    // Buscar journal
    const journals = await execKw(uid, 'account.journal', 'search_read',
      [[['type', '=', 'bank']]],
      { fields: ['id', 'name'], limit: 1 }
    )
    const journalId = journals.length > 0 ? journals[0].id : null
    if (!journalId) throw new Error('No se encontró journal bank')

    paymentId = await execKw(uid, 'account.payment', 'create', [{
      partner_id: partnerId,
      partner_type: 'customer',
      payment_type: 'inbound',
      journal_id: journalId,
      amount: 1.0,
      ref: `${PREFIX}_PAYMENT`,
    }])
    results.cleanup.push({ model: 'account.payment', id: paymentId, action: 'write state=canceled' })
    console.log(`[payment] Creado account.payment id=${paymentId}`)
  }
  results.paymentIdUsed = paymentId

  // ============================================================
  // ESCENARIO 1 — ir.attachment con tag_ids
  // ============================================================
  console.log('\n[E1] ir.attachment fields_get tag_ids...')
  const s1 = { preCheck: {}, createResult: null, reread: null, error: null }
  results.scenarios.escenario1_irAttachment_tagIds = s1

  try {
    // pre-check: ¿existe campo tag_ids en ir.attachment?
    const fieldsAttachment = await execKw(uid, 'ir.attachment', 'fields_get',
      [['tag_ids']],
      { attributes: ['string', 'type', 'relation'] }
    )
    s1.preCheck.tag_ids_field = fieldsAttachment['tag_ids'] || null
    console.log(`[E1] ir.attachment.tag_ids field:`, JSON.stringify(fieldsAttachment['tag_ids'] ?? 'NO EXISTE'))
  } catch (e) {
    s1.preCheck.error = e.message
    console.warn(`[E1] fields_get error: ${e.message}`)
  }

  try {
    const attName = `${PREFIX}_1.pdf`
    console.log(`[E1] Creando ir.attachment name=${attName}...`)
    const attId = await execKw(uid, 'ir.attachment', 'create', [{
      name: attName,
      datas: dummyPdf,
      mimetype: 'application/pdf',
      res_model: 'account.payment',
      res_id: paymentId,
      tag_ids: [[6, 0, [TAG_ID]]],
    }])
    s1.createResult = { id: attId, success: true }
    results.cleanup.push({ model: 'ir.attachment', id: attId, action: 'rename _CLEANED_' })
    console.log(`[E1] ir.attachment creado id=${attId}`)

    // re-read
    const reread = await execKw(uid, 'ir.attachment', 'read',
      [[attId], ['name', 'tag_ids', 'res_model', 'res_id']]
    )
    s1.reread = reread[0] || null
    console.log(`[E1] re-read tag_ids=${JSON.stringify(reread[0]?.tag_ids)}`)
  } catch (e) {
    s1.error = e.message
    s1.createResult = { success: false, error: e.message }
    console.error(`[E1] ERROR: ${e.message}`)
  }

  // ============================================================
  // ESCENARIO 2 — documents.document wrapper con tag_ids
  // ============================================================
  console.log('\n[E2] documents.document fields_get...')
  const s2 = { preCheck: {}, folderUsed: null, createResult: null, reread: null, attachmentId: null, irAttachmentRead: null, error: null }
  results.scenarios.escenario2_documentsDocument_tagIds = s2

  try {
    const fieldsDoc = await execKw(uid, 'documents.document', 'fields_get',
      [['folder_id', 'tag_ids', 'attachment_id', 'res_model', 'res_id', 'datas']],
      { attributes: ['string', 'type', 'relation', 'required'] }
    )
    s2.preCheck.fields = Object.fromEntries(
      Object.entries(fieldsDoc).map(([k, v]) => [k, { type: v.type, relation: v.relation, required: v.required }])
    )
    console.log('[E2] campos:', JSON.stringify(s2.preCheck.fields, null, 2))
  } catch (e) {
    s2.preCheck.error = e.message
    console.warn(`[E2] fields_get error: ${e.message}`)
  }

  // Buscar folder disponible
  try {
    const folders = await execKw(uid, 'documents.folder', 'search_read',
      [[]],
      { fields: ['id', 'name'], limit: 5 }
    )
    s2.preCheck.folders = folders
    if (folders.length > 0) {
      s2.folderUsed = folders[0]
      console.log(`[E2] folder seleccionado: id=${folders[0].id} name="${folders[0].name}"`)
    } else {
      console.warn('[E2] No se encontraron folders en documents.folder')
    }
  } catch (e) {
    s2.preCheck.foldersError = e.message
    console.warn(`[E2] search folders error: ${e.message}`)
  }

  try {
    const docName = `${PREFIX}_2.pdf`
    const createPayload = {
      name: docName,
      datas: dummyPdf,
      mimetype: 'application/pdf',
      tag_ids: [[6, 0, [TAG_ID]]],
    }
    if (s2.folderUsed) createPayload.folder_id = s2.folderUsed.id

    console.log(`[E2] Creando documents.document name=${docName}...`)
    const docId = await execKw(uid, 'documents.document', 'create', [createPayload])
    s2.createResult = { id: docId, success: true }
    results.cleanup.push({ model: 'documents.document', id: docId, action: 'rename _CLEANED_' })
    console.log(`[E2] documents.document creado id=${docId}`)

    // re-read
    const rereadFields = ['name', 'tag_ids', 'attachment_id', 'folder_id']
    // intentar también res_model/res_id si el campo existe
    if (s2.preCheck.fields?.res_model) rereadFields.push('res_model')
    if (s2.preCheck.fields?.res_id) rereadFields.push('res_id')

    const docRead = await execKw(uid, 'documents.document', 'read',
      [[docId], rereadFields]
    )
    s2.reread = docRead[0] || null
    console.log(`[E2] re-read:`, JSON.stringify(s2.reread))

    // Si tiene attachment_id, leer el ir.attachment subyacente
    const attRef = s2.reread?.attachment_id
    if (attRef && Array.isArray(attRef) && attRef[0]) {
      const irAttId = attRef[0]
      s2.attachmentId = irAttId
      const irRead = await execKw(uid, 'ir.attachment', 'read',
        [[irAttId], ['name', 'res_model', 'res_id', 'mimetype']]
      )
      s2.irAttachmentRead = irRead[0] || null
      console.log(`[E2] ir.attachment subyacente id=${irAttId}:`, JSON.stringify(s2.irAttachmentRead))
    } else {
      console.log('[E2] documents.document sin attachment_id o campo no existe')
    }
  } catch (e) {
    s2.error = e.message
    s2.createResult = { success: false, error: e.message }
    console.error(`[E2] ERROR: ${e.message}`)
  }

  // ============================================================
  // ESCENARIO 3 — search_read documents.document filtrando por tag_ids=[47]
  // ============================================================
  console.log('\n[E3] search_read documents.document con tag_ids=[47]...')
  const s3 = { searchResult: null, docCreatedFound: false, error: null }
  results.scenarios.escenario3_searchByTag = s3

  try {
    const found = await execKw(uid, 'documents.document', 'search_read',
      [[['tag_ids', 'in', [TAG_ID]]]],
      { fields: ['id', 'name', 'attachment_id', 'tag_ids'], limit: 10 }
    )
    s3.searchResult = found
    const docIdCreated = results.scenarios.escenario2_documentsDocument_tagIds?.createResult?.id
    if (docIdCreated) {
      s3.docCreatedFound = found.some(d => d.id === docIdCreated)
    }
    console.log(`[E3] encontrados ${found.length} documentos con tag_ids in [${TAG_ID}]`)
    console.log(`[E3] doc E2 (id=${docIdCreated}) encontrado en búsqueda: ${s3.docCreatedFound}`)
  } catch (e) {
    s3.error = e.message
    console.error(`[E3] ERROR: ${e.message}`)
  }

  // ============================================================
  // CLEANUP
  // ============================================================
  console.log('\n[cleanup] Ejecutando cleanup...')
  const cleanupTs = Date.now()
  const cleanupLog = []

  for (const item of results.cleanup) {
    try {
      if (item.action === 'rename _CLEANED_') {
        await execKw(uid, item.model, 'write', [[item.id], { name: `_CLEANED_${cleanupTs}_${item.model}_${item.id}` }])
        cleanupLog.push({ ...item, done: true, cleanedName: `_CLEANED_${cleanupTs}_${item.model}_${item.id}` })
        console.log(`[cleanup] renamed ${item.model} id=${item.id}`)
      } else if (item.action === 'write state=canceled') {
        await execKw(uid, item.model, 'write', [[item.id], { state: 'canceled' }])
        cleanupLog.push({ ...item, done: true })
        console.log(`[cleanup] canceled ${item.model} id=${item.id}`)
      }
    } catch (e) {
      cleanupLog.push({ ...item, done: false, error: e.message })
      console.error(`[cleanup] ERROR en ${item.model} id=${item.id}: ${e.message}`)
    }
  }
  results.cleanupLog = cleanupLog

  // ============================================================
  // VEREDICTO
  // ============================================================
  const e1Ok = results.scenarios.escenario1_irAttachment_tagIds?.createResult?.success === true
  const e1TagPersisted = (() => {
    const tags = results.scenarios.escenario1_irAttachment_tagIds?.reread?.tag_ids
    return Array.isArray(tags) && tags.length > 0
  })()
  const e2Ok = results.scenarios.escenario2_documentsDocument_tagIds?.createResult?.success === true
  const e2TagPersisted = (() => {
    const tags = results.scenarios.escenario2_documentsDocument_tagIds?.reread?.tag_ids
    return Array.isArray(tags) && tags.length > 0
  })()
  const e3Found = results.scenarios.escenario3_searchByTag?.docCreatedFound === true

  let recommendation
  if (e1Ok && e1TagPersisted) {
    recommendation = 'PATRON_B_CON_TAG_IDS_INLINE'
  } else if (e2Ok && e2TagPersisted && e3Found) {
    recommendation = 'DOCUMENTS_DOCUMENT_WRAPPER'
  } else if (e2Ok && e2TagPersisted) {
    recommendation = 'DOCUMENTS_DOCUMENT_WRAPPER_SIN_BUSQUEDA'
  } else {
    recommendation = 'PATRON_B_SIN_TAG_DEGRADED'
  }

  results.verdict = {
    irAttachmentAcceptsTagIds: e1Ok,
    irAttachmentTagPersisted: e1TagPersisted,
    documentsDocumentWorks: e2Ok,
    documentsDocumentTagPersisted: e2TagPersisted,
    searchByTagFindsDoc: e3Found,
    recommendation,
    story94Path: {
      PATRON_B_CON_TAG_IDS_INLINE: 'Usar ir.attachment directamente con tag_ids inline. Simple, 1 call extra de create.',
      DOCUMENTS_DOCUMENT_WRAPPER: 'Crear documents.document wrapper con tag_ids. Visible en Documents app filtrando por tag.',
      DOCUMENTS_DOCUMENT_WRAPPER_SIN_BUSQUEDA: 'Crear documents.document wrapper pero search by tag no funciona correctamente.',
      PATRON_B_SIN_TAG_DEGRADED: 'Patrón B sin tag (degraded). Paloma busca via chatter del payment.',
    }[recommendation],
  }

  console.log('\n[VEREDICTO]')
  console.log(`  ir.attachment acepta tag_ids: ${e1Ok} | persiste: ${e1TagPersisted}`)
  console.log(`  documents.document funciona: ${e2Ok} | tag persiste: ${e2TagPersisted}`)
  console.log(`  search by tag encuentra doc E2: ${e3Found}`)
  console.log(`  RECOMENDACION: ${recommendation}`)

  // --- guardar output ---
  const outDir = resolve(__dirname, 'audit-output')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, '9-4-tag-validation.json')
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8')
  console.log(`\n[done] Output guardado en ${outPath}`)
}

main().catch(e => {
  console.error('[FATAL]', e)
  process.exit(1)
})
