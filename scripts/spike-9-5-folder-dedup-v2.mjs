/**
 * Spike 9.5 v2 — re-evaluar tras descubrir que documents.folder NO existe en Odoo 18.
 * En Odoo 18 las "folders" son documents.document con type='folder'.
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
const { ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY } = process.env
const TS = Date.now()
const PREFIX = `spike_9_5v2_${TS}`
const host = new URL(ODOO_URL).hostname
const mkClient = (p) => xmlrpc.createSecureClient({ host, port: 443, path: p })
const common = mkClient('/xmlrpc/2/common')
const object = mkClient('/xmlrpc/2/object')
const call = (c, m, p, t = 90000) => new Promise((res, rej) => {
  const to = setTimeout(() => rej(new Error(`Timeout`)), t)
  c.methodCall(m, p, (e, v) => { clearTimeout(to); e ? rej(e) : res(v) })
})
const auth = async () => call(common, 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
const execKw = (uid, model, method, args, kwargs = {}) =>
  call(object, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs])

function normalize(name) {
  if (!name) return ''
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/(\d+)$/, '')
    .trim()
}

const results = { ts: new Date().toISOString(), prefix: PREFIX, hypotheses: {}, createdArtifacts: [] }

async function main() {
  const uid = await auth()
  console.log(`[auth] uid=${uid}`)

  // H1v2: documents.document.type field exists? folder records exist?
  console.log('\n[H1v2] documents.document.type fields_get + folder records...')
  const H1 = { hipotesis: 'En Odoo 18 las folders son documents.document con type=folder', resultado: null, evidencia: null }
  try {
    const fg = await execKw(uid, 'documents.document', 'fields_get', [['type', 'folder_id', 'parent_folder_id']], { attributes: ['type', 'relation', 'required', 'selection', 'string'] })
    H1.fieldsRaw = fg
    const folderTypeExists = !!fg.type
    let folderRecords = []
    if (folderTypeExists) {
      // intentar buscar type=folder
      try {
        folderRecords = await execKw(uid, 'documents.document', 'search_read',
          [[['type', '=', 'folder']]], { fields: ['id', 'name', 'folder_id', 'parent_folder_id', 'type'], limit: 5 }
        )
      } catch (e) {
        H1.searchFolderErr = e.message?.slice(0, 200)
      }
    }
    H1.resultado = folderTypeExists && folderRecords.length > 0
    H1.evidencia = `type field: ${fg.type ? `selection=${JSON.stringify(fg.type.selection)}` : 'NO existe'}; folder_id.relation=${fg.folder_id?.relation}; parent_folder_id.relation=${fg.parent_folder_id?.relation}; folder records sample=${folderRecords.length}`
    H1.sampleFolders = folderRecords
  } catch (e) {
    H1.resultado = false
    H1.evidencia = `ERR: ${e.message?.slice(0, 300)}`
  }
  results.hypotheses.H1v2 = H1
  console.log(`[H1v2] ${H1.resultado} — ${H1.evidencia}`)

  // H6v2: documents.document tag_ids ya sabemos que existe (story 9.4 lo usa). Confirmar también works en records type=folder.
  console.log('\n[H6v2] documents.document.tag_ids + aplica a type=folder?...')
  const H6 = { hipotesis: 'tag_ids en documents.document aplica también a records type=folder', resultado: null, evidencia: null }
  try {
    const fg = await execKw(uid, 'documents.document', 'fields_get', [['tag_ids']], { attributes: ['type', 'relation', 'string'] })
    H6.tagsField = fg.tag_ids
    // ver si algun folder ya tiene tag_ids
    let foldersWithTags = []
    try {
      foldersWithTags = await execKw(uid, 'documents.document', 'search_read',
        [[['type', '=', 'folder'], ['tag_ids', '!=', false]]],
        { fields: ['id', 'name', 'tag_ids'], limit: 5 }
      )
    } catch (e) {
      H6.searchErr = e.message?.slice(0, 200)
    }
    H6.resultado = !!fg.tag_ids
    H6.evidencia = `tag_ids type=${fg.tag_ids?.type} relation=${fg.tag_ids?.relation}; folders con tags ya existentes=${foldersWithTags.length}`
    H6.foldersWithTagsSample = foldersWithTags
  } catch (e) {
    H6.resultado = false
    H6.evidencia = `ERR: ${e.message?.slice(0, 300)}`
  }
  results.hypotheses.H6v2 = H6
  console.log(`[H6v2] ${H6.resultado} — ${H6.evidencia}`)

  // H2v2: crear custom field x_canonical_folder_id Many2one self en documents.document
  console.log('\n[H2v2] crear x_canonical_folder_id en documents.document...')
  const H2 = { hipotesis: 'documents.document admite custom field x_canonical_folder_id Many2one self', resultado: null, evidencia: null }
  try {
    const modelRec = await execKw(uid, 'ir.model', 'search_read',
      [[['model', '=', 'documents.document']]], { fields: ['id', 'model'], limit: 1 }
    )
    if (!modelRec[0]) throw new Error('ir.model documents.document not found')
    const fieldName = `x_${PREFIX}_canon`
    const fieldId = await execKw(uid, 'ir.model.fields', 'create', [{
      model_id: modelRec[0].id,
      name: fieldName,
      field_description: 'Spike 9.5 v2 canonical doc ref (test)',
      ttype: 'many2one',
      relation: 'documents.document',
      state: 'manual',
    }])
    H2.resultado = true
    H2.evidencia = `OK field id=${fieldId} name=${fieldName} type=many2one relation=documents.document`
    H2.fieldId = fieldId
    H2.fieldName = fieldName
    results.createdArtifacts.push({ model: 'ir.model.fields', id: fieldId, name: fieldName, note: 'Many2one self en documents.document — Paloma puede mantenerlo o renombrar' })
  } catch (e) {
    H2.resultado = false
    H2.evidencia = `ERR: ${e.message?.slice(0, 400)}`
  }
  results.hypotheses.H2v2 = H2
  console.log(`[H2v2] ${H2.resultado} — ${H2.evidencia?.slice(0, 250)}`)

  // H5v2: contar clusters duplicados de folders (documents.document type=folder)
  console.log('\n[H5v2] clusters duplicados type=folder...')
  const H5 = { hipotesis: '~26 clusters folders dup', resultado: null, evidencia: null }
  try {
    const all = await execKw(uid, 'documents.document', 'search_read',
      [[['type', '=', 'folder']]], { fields: ['id', 'name', 'folder_id', 'parent_folder_id'] }
    )
    const buckets = new Map()
    for (const f of all) {
      const key = normalize(f.name)
      if (!key) continue
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push({ id: f.id, name: f.name, parent: f.folder_id || f.parent_folder_id })
    }
    const clusters = [...buckets.entries()].filter(([, arr]) => arr.length > 1)
    const dupFolders = clusters.reduce((s, [, arr]) => s + arr.length, 0)
    H5.resultado = true
    H5.totalFolders = all.length
    H5.clustersCount = clusters.length
    H5.dupFoldersCount = dupFolders
    H5.evidencia = `total folders=${all.length}, clusters dup=${clusters.length}, folders en clusters=${dupFolders}`
    H5.clustersSample = clusters.slice(0, 12).map(([k, arr]) => ({ key: k, count: arr.length, ids: arr.map(x => x.id), names: arr.map(x => x.name) }))
  } catch (e) {
    H5.resultado = false
    H5.evidencia = `ERR: ${e.message?.slice(0, 300)}`
  }
  results.hypotheses.H5v2 = H5
  console.log(`[H5v2] ${H5.resultado} — ${H5.evidencia}`)

  // VEREDICTO
  let camino, recomendacion
  if (H1.resultado && H2.resultado && H6.resultado) {
    camino = 'A* (Odoo 18 unified model)'
    recomendacion = 'documents.folder NO existe en Odoo 18 (rebrand). Folders = documents.document type=folder. Camino A: custom field x_canonical_folder_id Many2one self en documents.document marca dup → canónico. Tags también disponibles (Camino C alterno) — recomendar A por semántica explícita 1:1.'
  } else if (H1.resultado && H6.resultado) {
    camino = 'C (tag-based)'
    recomendacion = 'Custom field falló pero tag_ids OK. Crear tags "folder-canonico"/"folder-duplicado" y aplicarlos a type=folder records.'
  } else {
    camino = 'INDETERMINATE'
    recomendacion = 'Revisar manualmente.'
  }
  results.verdict = { camino, recomendacion, H1: H1.resultado, H2: H2.resultado, H5: H5.resultado, H6: H6.resultado }

  console.log(`\n[VEREDICTO v2] Camino=${camino}\n  ${recomendacion}`)

  const outDir = resolve(__dirname, 'audit-output')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, '9-5-folder-dedup-v2.json'), JSON.stringify(results, null, 2), 'utf8')
}

main().catch(e => { console.error('[FATAL]', e); process.exit(1) })
