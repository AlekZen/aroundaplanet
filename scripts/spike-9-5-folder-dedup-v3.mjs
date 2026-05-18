/**
 * Spike 9.5 v3 — folders explorer. Type=folder retornó 0. Probar shortcut/folder_id.
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
  const to = setTimeout(() => rej(new Error('Timeout')), 120000)
  c.methodCall(m, p, (e, v) => { clearTimeout(to); e ? rej(e) : res(v) })
})
const auth = async () => call(common, 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
const execKw = (uid, model, method, args, kwargs = {}) =>
  call(object, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs])

function normalize(name) {
  if (!name) return ''
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').replace(/(\d+)$/, '').trim()
}

async function main() {
  const uid = await auth()
  console.log(`[auth] uid=${uid}`)
  const out = {}

  // 1) total documents.document (sin filtros)
  console.log('\n[1] search_count total documents.document...')
  try {
    const total = await execKw(uid, 'documents.document', 'search_count', [[]])
    out.totalAll = total
    console.log(`  total=${total}`)
  } catch (e) { out.totalAllErr = e.message?.slice(0, 200) }

  // 2) sample primeros 5 con type
  console.log('\n[2] sample 5 docs con id,name,type,shortcut_document_id,folder_id...')
  try {
    const fields = ['id', 'name', 'type', 'folder_id', 'shortcut_document_id']
    const sample = await execKw(uid, 'documents.document', 'search_read', [[]], { fields, limit: 5 })
    out.sample = sample
    sample.forEach(s => console.log(`  ${JSON.stringify(s)}`))
  } catch (e) { out.sampleErr = e.message?.slice(0, 200) }

  // 3) read_group por type
  console.log('\n[3] read_group por type...')
  try {
    const groups = await execKw(uid, 'documents.document', 'read_group',
      [[], ['type'], ['type']], {}
    )
    out.groupsByType = groups
    console.log('  ', JSON.stringify(groups))
  } catch (e) { out.groupsErr = e.message?.slice(0, 300); console.error('  ERR:', e.message?.slice(0, 200)) }

  // 4) buscar via folder_id IS NULL (top-level "folders" en algunas versiones son docs sin folder_id)
  console.log('\n[4] documents.document con folder_id=false (top-level)...')
  try {
    const top = await execKw(uid, 'documents.document', 'search_count', [[['folder_id', '=', false]]])
    out.topLevelCount = top
    console.log(`  count=${top}`)
    const topSample = await execKw(uid, 'documents.document', 'search_read',
      [[['folder_id', '=', false]]], { fields: ['id', 'name', 'type'], limit: 5 }
    )
    out.topLevelSample = topSample
  } catch (e) { out.topErr = e.message?.slice(0, 200) }

  // 5) buscar via shortcut_document_id == false AND type=folder con context active_test=False
  console.log('\n[5] search_count type=folder con active_test=False...')
  try {
    const ct = await execKw(uid, 'documents.document', 'search_count', [[['type', '=', 'folder']]], { context: { active_test: false } })
    out.folderCountAllStates = ct
    console.log(`  count=${ct}`)
  } catch (e) { out.fcErr = e.message?.slice(0, 200) }

  // 6) tentar modelo legacy documents.folder pero con method check_object_reference
  console.log('\n[6] ir.model search documents...')
  try {
    const models = await execKw(uid, 'ir.model', 'search_read',
      [[['model', 'like', 'documents.']]], { fields: ['id', 'model', 'name'], limit: 20 }
    )
    out.documentsModels = models
    models.forEach(m => console.log(`  ${m.model} — ${m.name}`))
  } catch (e) { out.modelsErr = e.message?.slice(0, 200) }

  // 7) Si existe campo 'shortcut_document_id', es Odoo 18 nuevo donde folders son docs type=folder. Si no, modelo viejo.
  console.log('\n[7] documents.document fields snapshot...')
  try {
    const fg = await execKw(uid, 'documents.document', 'fields_get', [['type', 'folder_id', 'shortcut_document_id', 'is_folder', 'children_ids']], { attributes: ['type', 'string', 'relation'] })
    out.docFields = fg
    console.log('  ', JSON.stringify(fg, null, 2))
  } catch (e) { out.fgErr = e.message?.slice(0, 200) }

  // 8) Si en (3) o (5) encontramos folder count > 0, intentar batch dedup analysis
  if (out.folderCountAllStates > 0) {
    console.log('\n[8] sacando todas las folders en chunks de 200...')
    try {
      const ids = await execKw(uid, 'documents.document', 'search', [[['type', '=', 'folder']]], { limit: 5000 })
      console.log(`  found ${ids.length} folder ids`)
      const folders = []
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = await execKw(uid, 'documents.document', 'read', [ids.slice(i, i + 200), ['id', 'name', 'folder_id']])
        folders.push(...chunk)
      }
      out.foldersTotal = folders.length
      const buckets = new Map()
      for (const f of folders) {
        const k = normalize(f.name); if (!k) continue
        if (!buckets.has(k)) buckets.set(k, [])
        buckets.get(k).push({ id: f.id, name: f.name, parent: f.folder_id })
      }
      const clusters = [...buckets.entries()].filter(([, a]) => a.length > 1)
      out.clusters = { total: folders.length, clustersDup: clusters.length, dupFolders: clusters.reduce((s, [, a]) => s + a.length, 0) }
      out.clustersSample = clusters.slice(0, 15).map(([k, arr]) => ({ key: k, count: arr.length, names: arr.map(x => x.name) }))
      console.log(`  clusters=${clusters.length} dupFolders=${out.clusters.dupFolders}`)
    } catch (e) { out.batchErr = e.message?.slice(0, 300); console.error('  ERR:', out.batchErr) }
  }

  const outDir = resolve(__dirname, 'audit-output')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, '9-5-folder-explorer-v3.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log('\n[done]')
}
main().catch(e => { console.error('[FATAL]', e.message); process.exit(1) })
