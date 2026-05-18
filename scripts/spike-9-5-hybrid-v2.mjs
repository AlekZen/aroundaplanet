/**
 * Spike 9.5 hybrid v2 — facet NO existe en Odoo 18.
 * Re-validar H9/H10/H11 sin facet:
 *  - documents.tag standalone (sin facet) ya validado en v1 (tag 48 creado OK)
 *  - H10 v2: crear 2 tags spike sin facet
 *  - H11 v2: write tag_ids sobre folder _CLEANED_ (id 2018 ó 2019) y rollback
 */
import xmlrpc from 'xmlrpc'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
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
const host = new URL(ODOO_URL).hostname
const mkClient = (p) => xmlrpc.createSecureClient({ host, port: 443, path: p })
const common = mkClient('/xmlrpc/2/common')
const object = mkClient('/xmlrpc/2/object')
const call = (c, m, p) => new Promise((res, rej) => {
  const to = setTimeout(() => rej(new Error('Timeout')), 90000)
  c.methodCall(m, p, (e, v) => { clearTimeout(to); e ? rej(e) : res(v) })
})
const auth = async () => call(common, 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
const execKw = (uid, model, method, args, kwargs = {}) =>
  call(object, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs])

const TS = Date.now()
const out = { ts: new Date().toISOString(), hypotheses: {}, created: [] }

async function main() {
  const uid = await auth()
  console.log(`[auth] uid=${uid}`)

  // H9 v2: documents.tag full fields_get
  console.log('\n[H9v2] documents.tag full fields_get...')
  const H9 = {}
  try {
    const allFields = await execKw(uid, 'documents.tag', 'fields_get', [[]], { attributes: ['type', 'relation', 'required', 'string'] })
    const fieldNames = Object.keys(allFields)
    H9.fields = fieldNames
    H9.relevant = { name: allFields.name, color: allFields.color, sequence: allFields.sequence }
    H9.resultado = true
    H9.evidencia = `fields=[${fieldNames.join(', ')}]; name.required=${allFields.name?.required}`
  } catch (e) {
    H9.resultado = false
    H9.evidencia = `ERR: ${e.message?.slice(0, 250)}`
  }
  out.hypotheses.H9v2 = H9
  console.log(`[H9v2] ${H9.resultado} — ${H9.evidencia?.slice(0, 300)}`)

  // H10 v2: crear 2 tags sin facet
  console.log('\n[H10v2] crear 2 tags sin facet...')
  const H10 = { tagIds: [] }
  try {
    const tagCanon = await execKw(uid, 'documents.tag', 'create', [{ name: `spike_9_5_canonico_${TS}_CLEANED` }])
    const tagDup = await execKw(uid, 'documents.tag', 'create', [{ name: `spike_9_5_duplicado_${TS}_CLEANED` }])
    H10.tagIds = [tagCanon, tagDup]
    H10.resultado = true
    H10.evidencia = `OK canonico=${tagCanon} duplicado=${tagDup} (sin facet_id)`
    out.created.push({ model: 'documents.tag', id: tagCanon, name: `spike_9_5_canonico_${TS}_CLEANED` })
    out.created.push({ model: 'documents.tag', id: tagDup, name: `spike_9_5_duplicado_${TS}_CLEANED` })
  } catch (e) {
    H10.resultado = false
    H10.evidencia = `ERR: ${e.message?.slice(0, 300)}`
  }
  out.hypotheses.H10v2 = H10
  console.log(`[H10v2] ${H10.resultado} — ${H10.evidencia}`)

  // H11 v2: write tag_ids sobre folder _CLEANED_ no crítico
  console.log('\n[H11v2] write tag_ids sobre folder no-crítico...')
  const H11 = {}
  if (H10.tagIds.length === 0) {
    H11.resultado = false; H11.evidencia = 'SKIP H10v2 falló'
  } else {
    let targetFolderId = null
    try {
      // Buscar primero un folder _CLEANED_ type=folder. Si no hay (los 2018/2019 son binary), tomar el folder con id más alto.
      let candidates = await execKw(uid, 'documents.document', 'search_read',
        [[['type', '=', 'folder'], ['name', 'like', '_CLEANED_']]], { fields: ['id', 'name', 'tag_ids'], limit: 1 }
      )
      H11.cleanedFolderFound = candidates.length > 0
      if (candidates.length === 0) {
        // Tomar el más reciente — rollback completo restaura estado
        candidates = await execKw(uid, 'documents.document', 'search_read',
          [[['type', '=', 'folder']]], { fields: ['id', 'name', 'tag_ids'], limit: 1, order: 'id desc' }
        )
        H11.usedRecentFolder = true
      }
      const target = candidates[0]
      if (!target) throw new Error('Sin folder disponible')
      targetFolderId = target.id
      H11.targetFolder = { id: target.id, name: target.name, originalTags: target.tag_ids }
      const originalTags = target.tag_ids || []

      // 1) write spike tag
      await execKw(uid, 'documents.document', 'write',
        [[targetFolderId], { tag_ids: [[6, 0, [H10.tagIds[0]]]] }]
      )
      const afterWrite = await execKw(uid, 'documents.document', 'read', [[targetFolderId], ['id', 'name', 'tag_ids']])
      H11.afterWrite = afterWrite[0]
      const hasSpikeTag = (afterWrite[0]?.tag_ids || []).includes(H10.tagIds[0])

      // 2) rollback
      await execKw(uid, 'documents.document', 'write',
        [[targetFolderId], { tag_ids: [[6, 0, originalTags]] }]
      )
      const afterRollback = await execKw(uid, 'documents.document', 'read', [[targetFolderId], ['id', 'tag_ids']])
      H11.afterRollback = afterRollback[0]
      const rollbackOK = JSON.stringify((afterRollback[0]?.tag_ids || []).sort()) === JSON.stringify([...originalTags].sort())

      H11.resultado = hasSpikeTag && rollbackOK
      H11.evidencia = `target=${targetFolderId} "${target.name}" (cleanedFound=${H11.cleanedFolderFound}); write spike tag presente=${hasSpikeTag}; rollback OK=${rollbackOK}; origTags=${JSON.stringify(originalTags)}`
    } catch (e) {
      H11.resultado = false
      H11.evidencia = `ERR (target=${targetFolderId}): ${e.message?.slice(0, 350)}`
    }
  }
  out.hypotheses.H11v2 = H11
  console.log(`[H11v2] ${H11.resultado} — ${H11.evidencia?.slice(0, 350)}`)

  // VEREDICTO
  const tagPathViable = H9.resultado && H10.resultado && H11.resultado
  out.verdict = {
    facetExists: false,
    facetEvidencia: 'documents.facet NO existe en Odoo 18 (XML-RPC fault: Object documents.facet doesn\'t exist). documents.tag.facet_id tampoco existe como campo.',
    hybridViable: tagPathViable,
    hybridAdjusted: 'Camino híbrido viable SIN facet: tags planos (sin agrupación) + custom field x_canonical_folder_id (validado en spike v2 prior). UI Odoo agrupa tags por nombre/prefijo.',
    H9: H9.resultado, H10: H10.resultado, H11: H11.resultado,
  }
  console.log(`\n[VEREDICTO] hybrid (sin facet) viable=${tagPathViable}`)

  const outDir = resolve(__dirname, 'audit-output')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, '9-5-hybrid-v2.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log('[done]')
}
main().catch(e => { console.error('[FATAL]', e.message); process.exit(1) })
