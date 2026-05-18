/**
 * Spike 9.5 hybrid — H7-H12 validation
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

  // H7
  console.log('\n[H7] documents.facet accesible?')
  const H7 = {}
  try {
    const fg = await execKw(uid, 'documents.facet', 'fields_get', [['name', 'folder_id', 'tag_ids']], { attributes: ['type', 'relation', 'required', 'string'] })
    H7.fields = fg
    const sample = await execKw(uid, 'documents.facet', 'search_read', [[]], { fields: ['id', 'name', 'folder_id'], limit: 5 })
    H7.sample = sample
    H7.resultado = true
    H7.evidencia = `fields_get OK; sample ${sample.length} facets: ${sample.map(f => `[${f.id}]${f.name}(folder=${JSON.stringify(f.folder_id)})`).join(' | ')}`
  } catch (e) {
    H7.resultado = false
    H7.evidencia = `ERR: ${e.message?.slice(0, 300)}`
  }
  out.hypotheses.H7 = H7
  console.log(`[H7] ${H7.resultado} — ${H7.evidencia?.slice(0, 200)}`)

  // H8 — create facet
  console.log('\n[H8] crear documents.facet test...')
  const H8 = {}
  let facetId = null
  if (!H7.resultado) {
    H8.resultado = false; H8.evidencia = 'SKIP H7 falló'
  } else {
    // verificar si folder_id es required
    const folderRequired = H7.fields?.folder_id?.required
    H8.folderIdRequired = folderRequired
    const facetName = `spike_9_5_facet_${TS}_CLEANED`
    // intentar sin folder_id primero
    try {
      facetId = await execKw(uid, 'documents.facet', 'create', [{ name: facetName }])
      H8.resultado = true
      H8.evidencia = `OK facet id=${facetId} (sin folder_id, required=${folderRequired})`
      H8.facetId = facetId
      out.created.push({ model: 'documents.facet', id: facetId, name: facetName })
    } catch (eNoFolder) {
      // si requiere folder_id, buscar un folder (documents.document type=folder)
      try {
        const someFolder = await execKw(uid, 'documents.document', 'search_read', [[['type', '=', 'folder']]], { fields: ['id', 'name'], limit: 1 })
        if (someFolder.length > 0) {
          facetId = await execKw(uid, 'documents.facet', 'create', [{ name: facetName, folder_id: someFolder[0].id }])
          H8.resultado = true
          H8.evidencia = `OK facet id=${facetId} (con folder_id=${someFolder[0].id}); create sin folder falló: ${eNoFolder.message?.slice(0, 150)}`
          H8.facetId = facetId
          out.created.push({ model: 'documents.facet', id: facetId, name: facetName, folder_id: someFolder[0].id })
        } else {
          H8.resultado = false
          H8.evidencia = `Sin folders disponibles; ERR sin folder_id: ${eNoFolder.message?.slice(0, 250)}`
        }
      } catch (e2) {
        H8.resultado = false
        H8.evidencia = `ERR doble fallo. sin folder: ${eNoFolder.message?.slice(0, 150)} | con folder: ${e2.message?.slice(0, 150)}`
      }
    }
  }
  out.hypotheses.H8 = H8
  console.log(`[H8] ${H8.resultado} — ${H8.evidencia?.slice(0, 250)}`)

  // H9 — documents.tag.facet_id fields_get
  console.log('\n[H9] documents.tag.facet_id required?')
  const H9 = {}
  try {
    const fg = await execKw(uid, 'documents.tag', 'fields_get', [['facet_id']], { attributes: ['type', 'relation', 'required', 'string'] })
    H9.fieldRaw = fg.facet_id
    H9.resultado = !!fg.facet_id
    H9.evidencia = `type=${fg.facet_id?.type} relation=${fg.facet_id?.relation} required=${fg.facet_id?.required}`
  } catch (e) {
    H9.resultado = false
    H9.evidencia = `ERR: ${e.message?.slice(0, 250)}`
  }
  out.hypotheses.H9 = H9
  console.log(`[H9] ${H9.resultado} — ${H9.evidencia}`)

  // H10 — crear 2 tags con facet
  console.log('\n[H10] crear 2 tags con facet_id...')
  const H10 = { tagIds: [] }
  if (!facetId) {
    H10.resultado = false; H10.evidencia = 'SKIP H8 falló'
  } else {
    try {
      const tagCanonId = await execKw(uid, 'documents.tag', 'create', [{ name: `spike_9_5_tag_canonico_${TS}_CLEANED`, facet_id: facetId }])
      const tagDupId = await execKw(uid, 'documents.tag', 'create', [{ name: `spike_9_5_tag_duplicado_${TS}_CLEANED`, facet_id: facetId }])
      H10.tagIds = [tagCanonId, tagDupId]
      H10.resultado = true
      H10.evidencia = `OK canonico=${tagCanonId} duplicado=${tagDupId}`
      out.created.push({ model: 'documents.tag', id: tagCanonId, name: `spike_9_5_tag_canonico_${TS}_CLEANED`, facet_id: facetId })
      out.created.push({ model: 'documents.tag', id: tagDupId, name: `spike_9_5_tag_duplicado_${TS}_CLEANED`, facet_id: facetId })
    } catch (e) {
      H10.resultado = false
      H10.evidencia = `ERR: ${e.message?.slice(0, 300)}`
    }
  }
  out.hypotheses.H10 = H10
  console.log(`[H10] ${H10.resultado} — ${H10.evidencia}`)

  // H11 — write tag_ids sobre folder existente NO crítico (id=2018 ó 2019 ó buscar uno _CLEANED_ type=folder, si no hay, usar uno common type=folder con cuidado y revertir)
  console.log('\n[H11] write tag_ids sobre folder no-crítico...')
  const H11 = {}
  if (H10.tagIds.length === 0) {
    H11.resultado = false; H11.evidencia = 'SKIP H10 falló'
  } else {
    let targetFolderId = null
    try {
      // buscar primero un folder _CLEANED_
      let candidates = await execKw(uid, 'documents.document', 'search_read',
        [[['type', '=', 'folder'], ['name', 'like', '_CLEANED_']]], { fields: ['id', 'name', 'tag_ids'], limit: 1 }
      )
      if (candidates.length === 0) {
        // fallback: tomar el folder con id más alto (más reciente) que NO sea crítico — preferimos rollback rápido
        candidates = await execKw(uid, 'documents.document', 'search_read',
          [[['type', '=', 'folder']]], { fields: ['id', 'name', 'tag_ids'], limit: 1, order: 'id desc' }
        )
        H11.usedFallback = true
      }
      if (candidates.length === 0) throw new Error('Sin folders disponibles para test')
      const target = candidates[0]
      targetFolderId = target.id
      H11.targetFolder = target
      const originalTags = target.tag_ids || []
      H11.originalTags = originalTags

      // write tag spike
      await execKw(uid, 'documents.document', 'write',
        [[targetFolderId], { tag_ids: [[6, 0, [H10.tagIds[0]]]] }]
      )
      // read
      const after = await execKw(uid, 'documents.document', 'read', [[targetFolderId], ['id', 'name', 'tag_ids']])
      H11.afterWrite = after[0]
      const hasSpikeTag = (after[0]?.tag_ids || []).includes(H10.tagIds[0])

      // rollback: restaurar tags originales
      await execKw(uid, 'documents.document', 'write',
        [[targetFolderId], { tag_ids: [[6, 0, originalTags]] }]
      )
      const afterRollback = await execKw(uid, 'documents.document', 'read', [[targetFolderId], ['id', 'tag_ids']])
      H11.afterRollback = afterRollback[0]
      const rollbackOK = JSON.stringify((afterRollback[0]?.tag_ids || []).sort()) === JSON.stringify([...originalTags].sort())

      H11.resultado = hasSpikeTag && rollbackOK
      H11.evidencia = `target folder=${targetFolderId} "${target.name}"; write OK (spike tag presente=${hasSpikeTag}); rollback OK=${rollbackOK} (tags originales: ${JSON.stringify(originalTags)})`
    } catch (e) {
      H11.resultado = false
      H11.evidencia = `ERR (target=${targetFolderId}): ${e.message?.slice(0, 350)}`
    }
  }
  out.hypotheses.H11 = H11
  console.log(`[H11] ${H11.resultado} — ${H11.evidencia?.slice(0, 300)}`)

  // H12 — shortcut_document_id
  console.log('\n[H12] documents.document.shortcut_document_id...')
  const H12 = {}
  try {
    const fg = await execKw(uid, 'documents.document', 'fields_get', [['shortcut_document_id']], { attributes: ['type', 'relation', 'help', 'string', 'required'] })
    H12.raw = fg.shortcut_document_id
    H12.resultado = !!fg.shortcut_document_id
    H12.evidencia = `type=${fg.shortcut_document_id?.type} relation=${fg.shortcut_document_id?.relation} string="${fg.shortcut_document_id?.string}" help="${fg.shortcut_document_id?.help || '(sin help)'}"`
    // contar cuántos docs usan shortcut hoy
    try {
      const cnt = await execKw(uid, 'documents.document', 'search_count', [[['shortcut_document_id', '!=', false]]])
      H12.shortcutsExistentes = cnt
    } catch {}
  } catch (e) {
    H12.resultado = false
    H12.evidencia = `ERR: ${e.message?.slice(0, 250)}`
  }
  out.hypotheses.H12 = H12
  console.log(`[H12] ${H12.resultado} — ${H12.evidencia}`)

  // VEREDICTO
  const allOK = H7.resultado && H8.resultado && H9.resultado && H10.resultado && H11.resultado
  out.verdict = {
    hybridViable: allOK,
    summary: `Camino híbrido (facet+tags+custom field paralelo) viable: ${allOK}`,
    H7: H7.resultado, H8: H8.resultado, H9: H9.resultado, H10: H10.resultado, H11: H11.resultado, H12: H12.resultado,
  }
  console.log(`\n[VEREDICTO] hybrid viable=${allOK}`)

  const outDir = resolve(__dirname, 'audit-output')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, '9-5-hybrid.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log('[done]')
}
main().catch(e => { console.error('[FATAL]', e.message); process.exit(1) })
