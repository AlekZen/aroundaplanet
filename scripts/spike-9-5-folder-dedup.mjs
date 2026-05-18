/**
 * Spike 9.5 — Folder dedup validation
 *
 * Valida 6 hipotesis ANTES de codear Story 9.5:
 *  H1: documents.folder accesible via XML-RPC search_read?
 *  H2: documents.folder admite custom field x_canonical_folder_id (Many2one self) creado via ir.model.fields.create?
 *  H3: documents.tag admite crear tags 'spike_9_5_test_TBD' (verifica facet_id obligatorio)?
 *  H4: documents.document.folder_id existe? required o opcional? relation?
 *  H5: cuantos clusters de carpetas duplicadas hay HOY (normalizando nombres)?
 *  H6: documents.folder tiene tag_ids Many2many?
 *
 * NO unlink. NO modifica datos productivos (salvo crear 1 tag y/o 1 field test que se dejan con prefijo _CLEANED).
 * Output: scripts/audit-output/9-5-folder-dedup.json
 */
import xmlrpc from 'xmlrpc'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
const PREFIX = `spike_9_5_test_${TS}`

const host = new URL(ODOO_URL).hostname
const mkClient = (p) => xmlrpc.createSecureClient({ host, port: 443, path: p })
const common = mkClient('/xmlrpc/2/common')
const object = mkClient('/xmlrpc/2/object')

function call(client, method, params, timeoutMs = 90000) {
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
  if (!uid) throw new Error('Auth fallida')
  return uid
}

async function execKw(uid, model, method, args, kwargs = {}, timeoutMs = 90000) {
  return call(object, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs], timeoutMs)
}

function normalize(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/(\d+)$/, '') // strip trailing digits (MAYO1 -> MAYO)
    .trim()
}

const results = {
  timestamp: new Date().toISOString(),
  tenant: ODOO_URL,
  prefix: PREFIX,
  hypotheses: {},
  createdArtifacts: [],
}

async function main() {
  console.log('[spike-9-5] Iniciando...')
  const uid = await auth()
  console.log(`[auth] uid=${uid}`)

  // ============================================================
  // H1: documents.folder accesible via search_read?
  // ============================================================
  console.log('\n[H1] documents.folder search_read...')
  const H1 = { hipotesis: 'documents.folder accesible via XML-RPC search_read', resultado: null, evidencia: null }
  try {
    const sample = await execKw(uid, 'documents.folder', 'search_read',
      [[]], { fields: ['id', 'name', 'parent_folder_id'], limit: 5 }
    )
    H1.resultado = true
    H1.evidencia = `OK ${sample.length} folders sample: ${sample.map(f => `[${f.id}]${f.name}`).join(' | ')}`
  } catch (e) {
    H1.resultado = false
    H1.evidencia = `ERR: ${e.message?.slice(0, 300)}`
  }
  results.hypotheses.H1 = H1
  console.log(`[H1] ${H1.resultado} — ${H1.evidencia?.slice(0, 200)}`)

  // ============================================================
  // H4: documents.document.folder_id fields_get
  // ============================================================
  console.log('\n[H4] documents.document.folder_id fields_get...')
  const H4 = { hipotesis: 'documents.document.folder_id existe + required?', resultado: null, evidencia: null }
  try {
    const fg = await execKw(uid, 'documents.document', 'fields_get',
      [['folder_id']], { attributes: ['type', 'relation', 'required', 'string'] }
    )
    if (fg.folder_id) {
      H4.resultado = true
      H4.evidencia = `type=${fg.folder_id.type} relation=${fg.folder_id.relation} required=${fg.folder_id.required} string="${fg.folder_id.string}"`
      H4.raw = fg.folder_id
    } else {
      H4.resultado = false
      H4.evidencia = `field folder_id NO existe en documents.document`
    }
  } catch (e) {
    H4.resultado = false
    H4.evidencia = `ERR: ${e.message?.slice(0, 300)}`
  }
  results.hypotheses.H4 = H4
  console.log(`[H4] ${H4.resultado} — ${H4.evidencia}`)

  // ============================================================
  // H6: documents.folder.tag_ids existe?
  // ============================================================
  console.log('\n[H6] documents.folder.tag_ids fields_get...')
  const H6 = { hipotesis: 'documents.folder tiene tag_ids Many2many', resultado: null, evidencia: null }
  try {
    const fg = await execKw(uid, 'documents.folder', 'fields_get',
      [['tag_ids']], { attributes: ['type', 'relation', 'required', 'string'] }
    )
    if (fg.tag_ids && fg.tag_ids.type) {
      H6.resultado = true
      H6.evidencia = `type=${fg.tag_ids.type} relation=${fg.tag_ids.relation} string="${fg.tag_ids.string}"`
      H6.raw = fg.tag_ids
    } else {
      H6.resultado = false
      H6.evidencia = `tag_ids NO existe en documents.folder`
    }
  } catch (e) {
    H6.resultado = false
    H6.evidencia = `ERR: ${e.message?.slice(0, 300)}`
  }
  results.hypotheses.H6 = H6
  console.log(`[H6] ${H6.resultado} — ${H6.evidencia}`)

  // ============================================================
  // H3: crear documents.tag (verificar si facet_id es obligatorio)
  // ============================================================
  console.log('\n[H3] crear documents.tag test...')
  const H3 = { hipotesis: 'documents.tag admite crear tag adicional', resultado: null, evidencia: null }
  try {
    // primero ver fields requeridos
    const fg = await execKw(uid, 'documents.tag', 'fields_get',
      [['name', 'facet_id']], { attributes: ['type', 'relation', 'required'] }
    )
    H3.fieldsInfo = fg
    // intentar create sin facet
    let tagId
    let createMode
    try {
      tagId = await execKw(uid, 'documents.tag', 'create', [{ name: `${PREFIX}_no_facet_CLEANED` }])
      createMode = 'sin facet_id'
    } catch (eNoFacet) {
      // intentar con facet (buscar uno existente)
      const facets = await execKw(uid, 'documents.facet', 'search_read',
        [[]], { fields: ['id', 'name'], limit: 3 }
      )
      H3.facetsAvailable = facets
      if (facets.length > 0) {
        tagId = await execKw(uid, 'documents.tag', 'create', [{ name: `${PREFIX}_facet${facets[0].id}_CLEANED`, facet_id: facets[0].id }])
        createMode = `con facet_id=${facets[0].id}`
      } else {
        throw new Error(`No facets disponibles y create sin facet falló: ${eNoFacet.message}`)
      }
    }
    H3.resultado = true
    H3.evidencia = `tag id=${tagId} creado (${createMode}); fields_get: name.required=${fg.name?.required}, facet_id.required=${fg.facet_id?.required}`
    H3.tagId = tagId
    results.createdArtifacts.push({ model: 'documents.tag', id: tagId, name: `${PREFIX}_${createMode}_CLEANED` })
  } catch (e) {
    H3.resultado = false
    H3.evidencia = `ERR: ${e.message?.slice(0, 400)}`
  }
  results.hypotheses.H3 = H3
  console.log(`[H3] ${H3.resultado} — ${H3.evidencia?.slice(0, 250)}`)

  // ============================================================
  // H2: documents.folder admite custom field x_test_canonical_id Many2one self
  // (solo intentar si H1 OK)
  // ============================================================
  console.log('\n[H2] crear custom field Many2one self en documents.folder...')
  const H2 = { hipotesis: 'documents.folder admite x_canonical_folder_id Many2one self', resultado: null, evidencia: null }
  if (!H1.resultado) {
    H2.resultado = false
    H2.evidencia = 'SKIP — H1 falló (modelo no accesible)'
  } else {
    try {
      // 1) obtener ir.model id de documents.folder
      const modelRec = await execKw(uid, 'ir.model', 'search_read',
        [[['model', '=', 'documents.folder']]],
        { fields: ['id', 'model', 'name'], limit: 1 }
      )
      H2.modelRec = modelRec
      if (!modelRec || modelRec.length === 0) {
        H2.resultado = false
        H2.evidencia = `ir.model search vacío para documents.folder`
      } else {
        const modelId = modelRec[0].id
        const fieldName = `x_spike_9_5_test_${TS}`
        try {
          const fieldId = await execKw(uid, 'ir.model.fields', 'create', [{
            model_id: modelId,
            name: fieldName,
            field_description: 'Spike 9.5 test canonical folder ref',
            ttype: 'many2one',
            relation: 'documents.folder',
            state: 'manual',
          }])
          H2.resultado = true
          H2.evidencia = `OK ir.model.fields id=${fieldId} name=${fieldName} type=many2one relation=documents.folder`
          H2.fieldId = fieldId
          H2.fieldName = fieldName
          results.createdArtifacts.push({ model: 'ir.model.fields', id: fieldId, name: fieldName, note: 'leaves field on documents.folder — story may reuse or rename' })
        } catch (e) {
          H2.resultado = false
          H2.evidencia = `ERR create field: ${e.message?.slice(0, 400)}`
        }
      }
    } catch (e) {
      H2.resultado = false
      H2.evidencia = `ERR: ${e.message?.slice(0, 400)}`
    }
  }
  results.hypotheses.H2 = H2
  console.log(`[H2] ${H2.resultado} — ${H2.evidencia?.slice(0, 250)}`)

  // ============================================================
  // H5: cuántos clusters duplicados hay HOY
  // ============================================================
  console.log('\n[H5] contar clusters duplicados...')
  const H5 = { hipotesis: 'Existen ~26 clusters de folders duplicados (per session-35)', resultado: null, evidencia: null }
  if (!H1.resultado) {
    H5.resultado = null
    H5.evidencia = 'SKIP — H1 falló'
  } else {
    try {
      const all = await execKw(uid, 'documents.folder', 'search_read',
        [[]], { fields: ['id', 'name', 'parent_folder_id'] }
      )
      const total = all.length
      const buckets = new Map()
      for (const f of all) {
        const key = normalize(f.name)
        if (!key) continue
        if (!buckets.has(key)) buckets.set(key, [])
        buckets.get(key).push({ id: f.id, name: f.name, parent: f.parent_folder_id })
      }
      const clusters = [...buckets.entries()].filter(([, arr]) => arr.length > 1)
      const dupFolders = clusters.reduce((sum, [, arr]) => sum + arr.length, 0)
      H5.resultado = true
      H5.evidencia = `total folders=${total}, clusters dup=${clusters.length}, folders en clusters=${dupFolders}`
      H5.clustersCount = clusters.length
      H5.totalFolders = total
      H5.dupFoldersCount = dupFolders
      H5.clustersSample = clusters.slice(0, 10).map(([k, arr]) => ({ key: k, count: arr.length, folders: arr }))
    } catch (e) {
      H5.resultado = false
      H5.evidencia = `ERR: ${e.message?.slice(0, 300)}`
    }
  }
  results.hypotheses.H5 = H5
  console.log(`[H5] ${H5.resultado} — ${H5.evidencia}`)

  // ============================================================
  // VEREDICTO + CAMINO
  // ============================================================
  let camino, recomendacion
  if (H1.resultado && H2.resultado) {
    camino = 'A'
    recomendacion = 'Camino A: dedup vía custom field Many2one self en documents.folder (x_canonical_folder_id). Mas limpio semánticamente, marcar dup → apuntar al canónico.'
  } else if (H1.resultado && H6.resultado) {
    camino = 'C'
    recomendacion = 'Camino C: dedup vía documents.tag aplicado a folder.tag_ids (canonico/duplicado). No requiere custom field nuevo si documents.folder.tag_ids existe.'
  } else if (!H1.resultado) {
    camino = 'B'
    recomendacion = 'Camino B: documents.folder NO accesible — dedup vía custom field x_canonical_folder_name en documents.document + mapping en Firestore.'
  } else {
    camino = 'INDETERMINATE'
    recomendacion = 'Revisar manualmente; combinacion no cubierta.'
  }

  results.verdict = {
    camino,
    recomendacion,
    H1: H1.resultado,
    H2: H2.resultado,
    H3: H3.resultado,
    H4: H4.resultado,
    H5: H5.resultado,
    H6: H6.resultado,
  }

  console.log('\n[VEREDICTO]')
  console.log(`  Camino: ${camino}`)
  console.log(`  ${recomendacion}`)

  saveResults()
}

function saveResults() {
  const outDir = resolve(__dirname, 'audit-output')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, '9-5-folder-dedup.json')
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8')
  console.log(`\n[done] Output en ${outPath}`)
}

main().catch(e => {
  console.error('[FATAL]', e)
  saveResults()
  process.exit(1)
})
