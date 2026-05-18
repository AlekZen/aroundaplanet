/**
 * Descarga: logo.png (40741), contratos PDF reales recientes, logo de empresa.
 */
import xmlrpc from 'xmlrpc'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ODOO_DB = 'aroundaplanet'
const ODOO_USERNAME = 'noelnumata@gmail.com'
const ODOO_API_KEY = 'bd9e865a66e12c855f050521cfe2ef00bb1df7ad'

function createClient(p) { return xmlrpc.createSecureClient({ host: 'aroundaplanet.odoo.com', port: 443, path: p }) }
function call(c, m, p) { return new Promise((res, rej) => { const t=setTimeout(()=>rej(new Error('timeout')),60000); c.methodCall(m,p,(e,v)=>{clearTimeout(t);e?rej(e):res(v)}) }) }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SAMPLES_DIR = path.join(__dirname, 'audit-output', '10-1-4-samples')
if (!existsSync(SAMPLES_DIR)) mkdirSync(SAMPLES_DIR, { recursive: true })

async function main() {
  const common = createClient('/xmlrpc/2/common')
  const models = createClient('/xmlrpc/2/object')
  const uid = await call(common, 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])

  // logo.png attachment 40741 via ir.attachment
  const logo = await call(models, 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY,
    'ir.attachment', 'read', [[40741], ['datas', 'name', 'mimetype']],
  ])
  if (logo[0]?.datas) {
    writeFileSync(path.join(SAMPLES_DIR, 'odoo-documents-logo-40741.png'), Buffer.from(logo[0].datas, 'base64'))
    console.log('saved logo 40741', logo[0].mimetype)
  }

  // 3 contratos sample (Medio Oriente, Colombia, Perú) — IDs documents.document
  const contractIds = [1903, 1895, 1901]
  for (const id of contractIds) {
    try {
      const r = await call(models, 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY,
        'documents.document', 'read', [[id], ['datas', 'name', 'mimetype']],
      ])
      if (r[0]?.datas) {
        const safe = String(r[0].name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)
        writeFileSync(path.join(SAMPLES_DIR, `contract-${id}-${safe}`), Buffer.from(r[0].datas, 'base64'))
        console.log('saved contract', id, r[0].name)
      }
    } catch (e) { console.warn(id, e.message) }
  }

  // Company logos
  const companies = await call(models, 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY,
    'res.company', 'read', [[1, 2], ['name', 'logo']],
  ])
  for (const c of companies) {
    if (c.logo) {
      writeFileSync(path.join(SAMPLES_DIR, `company-${c.id}-logo.png`), Buffer.from(c.logo, 'base64'))
      console.log('saved company logo', c.id, c.name)
    }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
