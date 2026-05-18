/**
 * Story 10.1.4 — Buscar machote contrato + logo en Odoo Documents.
 * Output: scripts/audit-output/10-1-4-machote-search.json
 *         scripts/audit-output/10-1-4-samples/*.{pdf,png,jpg}
 */
import xmlrpc from 'xmlrpc'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ODOO_DB = 'aroundaplanet'
const ODOO_USERNAME = 'noelnumata@gmail.com'
const ODOO_API_KEY = 'bd9e865a66e12c855f050521cfe2ef00bb1df7ad'

function createClient(urlPath) {
  return xmlrpc.createSecureClient({ host: 'aroundaplanet.odoo.com', port: 443, path: urlPath })
}
function call(client, method, params) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout 60s')), 60000)
    client.methodCall(method, params, (err, v) => { clearTimeout(t); if (err) reject(err); else resolve(v) })
  })
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, 'audit-output')
const SAMPLES_DIR = path.join(OUT_DIR, '10-1-4-samples')
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
if (!existsSync(SAMPLES_DIR)) mkdirSync(SAMPLES_DIR, { recursive: true })

async function main() {
  const common = createClient('/xmlrpc/2/common')
  const models = createClient('/xmlrpc/2/object')
  const uid = await call(common, 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
  console.log('uid=', uid)

  // 1. Buscar documents.document por nombre que matchee contrato/machote/template/logo
  const docDomain = ['|', '|', '|', '|', '|',
    ['name', 'ilike', 'contrato'],
    ['name', 'ilike', 'machote'],
    ['name', 'ilike', 'template'],
    ['name', 'ilike', 'plantilla'],
    ['name', 'ilike', 'logo'],
    ['name', 'ilike', 'brand'],
  ]
  const docs = await call(models, 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY,
    'documents.document', 'search_read',
    [docDomain],
    { fields: ['id', 'name', 'mimetype', 'folder_id', 'tag_ids', 'create_date', 'file_size', 'type'], limit: 50, order: 'create_date desc' },
  ])
  console.log(`documents.document matches: ${docs.length}`)

  // 2. Listar folders top-level para encontrar carpeta "Plantillas" / "Templates" / "Branding"
  const folders = await call(models, 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY,
    'documents.folder', 'search_read',
    [[]],
    { fields: ['id', 'name', 'parent_folder_id'], limit: 200 },
  ]).catch(e => ({ error: e.message }))

  // 3. ir.attachment con res_model relacionado a templates
  const attachments = await call(models, 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY,
    'ir.attachment', 'search_read',
    [['|', '|', '|', ['name', 'ilike', 'contrato'], ['name', 'ilike', 'machote'], ['name', 'ilike', 'logo'], ['name', 'ilike', 'plantilla']]],
    { fields: ['id', 'name', 'mimetype', 'res_model', 'res_id', 'create_date', 'file_size'], limit: 50, order: 'create_date desc' },
  ])
  console.log(`ir.attachment matches: ${attachments.length}`)

  // 4. Empresa res.company logo
  const company = await call(models, 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY,
    'res.company', 'search_read',
    [[]],
    { fields: ['id', 'name', 'logo', 'partner_id'], limit: 3 },
  ])

  const summary = {
    timestamp: new Date().toISOString(),
    documentsDocumentMatches: docs.map(d => ({ ...d, folder_name: d.folder_id?.[1] || null })),
    foldersFound: folders,
    attachmentMatches: attachments,
    companies: company.map(c => ({ id: c.id, name: c.name, hasLogo: !!c.logo, logoSize: c.logo ? c.logo.length : 0 })),
  }
  writeFileSync(path.join(OUT_DIR, '10-1-4-machote-search.json'), JSON.stringify(summary, null, 2))
  console.log('wrote', path.join(OUT_DIR, '10-1-4-machote-search.json'))

  // 5. Descargar top 3 docs PDF y logo de empresa
  const candidates = [
    ...docs.filter(d => d.mimetype?.includes('pdf') || d.mimetype?.includes('image')).slice(0, 5),
  ]
  for (const c of candidates) {
    try {
      const full = await call(models, 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY,
        'documents.document', 'read', [[c.id], ['datas', 'name', 'mimetype']],
      ])
      if (full[0]?.datas) {
        const ext = c.mimetype?.includes('pdf') ? 'pdf' : c.mimetype?.includes('png') ? 'png' : 'jpg'
        const safe = String(c.name || `doc-${c.id}`).replace(/[^a-zA-Z0-9._-]/g, '_')
        const filePath = path.join(SAMPLES_DIR, `${c.id}-${safe}.${ext}`)
        writeFileSync(filePath, Buffer.from(full[0].datas, 'base64'))
        console.log('saved', filePath)
      }
    } catch (e) {
      console.warn('skip', c.id, e.message)
    }
  }

  // Logo de empresa
  if (company[0]?.logo) {
    writeFileSync(path.join(SAMPLES_DIR, `company-${company[0].id}-logo.png`), Buffer.from(company[0].logo, 'base64'))
    console.log('saved company logo')
  }
}
main().catch(e => { console.error(e); process.exit(1) })
