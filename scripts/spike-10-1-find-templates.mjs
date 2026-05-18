/**
 * spike-10-1-find-templates.mjs
 * Busca en documents.document de Odoo plantillas de contrato/cotización subidas por Paloma.
 *
 * Búsqueda fuzzy por:
 * - name ilike contrato | cotizacion | plantilla | template | adhesion | muestra
 * - mimetype application/pdf | docx | odt
 * - Devuelve folders padres para entender estructura
 */
import xmlrpc from 'xmlrpc'
import { writeFileSync } from 'fs'

const ODOO_URL = 'https://aroundaplanet.odoo.com'
const ODOO_DB = 'aroundaplanet'
const ODOO_USERNAME = 'noelnumata@gmail.com'
const ODOO_API_KEY = 'bd9e865a66e12c855f050521cfe2ef00bb1df7ad'

const HOST = 'aroundaplanet.odoo.com'
const mkClient = (p) => xmlrpc.createSecureClient({ host: HOST, port: 443, path: p })
const call = (c, m, p) =>
  new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), 30000)
    c.methodCall(m, p, (e, v) => {
      clearTimeout(t)
      e ? rej(e) : res(v)
    })
  })
const kw = (c, uid, model, method, args, kwargs = {}) =>
  call(c, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs])

async function main() {
  const common = mkClient('/xmlrpc/2/common')
  const object = mkClient('/xmlrpc/2/object')
  const uid = await call(common, 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
  console.log('uid:', uid)

  const KEYWORDS = [
    'contrato',
    'cotizacion',
    'cotización',
    'plantilla',
    'template',
    'adhesion',
    'adhesión',
    'muestra',
    'formato',
    'modelo',
  ]

  // OR domain por cada keyword en name (N-1 operadores '|' como entradas separadas)
  const domain = []
  for (let i = 0; i < KEYWORDS.length - 1; i++) domain.push('|')
  for (const k of KEYWORDS) domain.push(['name', 'ilike', k])

  const docs = await kw(object, uid, 'documents.document', 'search_read', [domain], {
    fields: [
      'id',
      'name',
      'type',
      'mimetype',
      'folder_id',
      'file_size',
      'create_date',
      'create_uid',
      'write_date',
      'description',
      'tag_ids',
      'owner_id',
    ],
    limit: 200,
    order: 'create_date desc',
  })

  console.log(`\n=== Documents matching templates keywords: ${docs.length} ===\n`)
  for (const d of docs) {
    console.log(
      `[${d.id}] ${d.name} | type=${d.type} | mime=${d.mimetype} | folder=${JSON.stringify(d.folder_id)} | size=${d.file_size}b | ${d.create_date}`
    )
  }

  // Folders únicos
  const folderIds = [...new Set(docs.map((d) => (Array.isArray(d.folder_id) ? d.folder_id[0] : null)).filter(Boolean))]
  let folders = []
  if (folderIds.length) {
    folders = await kw(object, uid, 'documents.document', 'read', [folderIds], {
      fields: ['id', 'name', 'type', 'folder_id', 'children_ids'],
    })
    console.log(`\n=== Parent folders (${folders.length}) ===`)
    for (const f of folders) console.log(`  [${f.id}] ${f.name} (children: ${(f.children_ids || []).length})`)
  }

  // Buscar folders cuyo name sugiera plantillas
  const folderDomain = [['type', '=', 'folder']]
  for (let i = 0; i < KEYWORDS.length - 1; i++) folderDomain.push('|')
  for (const k of KEYWORDS) folderDomain.push(['name', 'ilike', k])
  const templateFolders = await kw(object, uid, 'documents.document', 'search_read', [folderDomain], {
    fields: ['id', 'name', 'children_ids', 'folder_id'],
    limit: 50,
  })
  console.log(`\n=== Folders named like templates: ${templateFolders.length} ===`)
  for (const f of templateFolders)
    console.log(`  [${f.id}] ${f.name} (children: ${(f.children_ids || []).length}) parent=${JSON.stringify(f.folder_id)}`)

  // Si hay folder de plantillas, listar TODOS sus hijos sin filtro de keyword
  const allChildren = []
  for (const f of templateFolders) {
    if (!f.children_ids || !f.children_ids.length) continue
    const kids = await kw(object, uid, 'documents.document', 'read', [f.children_ids], {
      fields: ['id', 'name', 'type', 'mimetype', 'file_size', 'create_date'],
    })
    allChildren.push({ folder: f.name, folderId: f.id, items: kids })
    console.log(`\n=== Children of folder "${f.name}" (${kids.length}) ===`)
    for (const k of kids) console.log(`  [${k.id}] ${k.name} | ${k.type} | ${k.mimetype} | ${k.file_size}b`)
  }

  const output = { uid, keywords: KEYWORDS, matchingDocs: docs, parentFolders: folders, templateFolders, templateFolderChildren: allChildren }
  writeFileSync('scripts/audit-output/10-1-templates-discovery.json', JSON.stringify(output, null, 2))
  console.log('\n✓ saved scripts/audit-output/10-1-templates-discovery.json')
}

main().catch((e) => {
  console.error('ERROR:', e)
  process.exit(1)
})
