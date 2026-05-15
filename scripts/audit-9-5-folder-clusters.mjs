/**
 * audit-9-5-folder-clusters.mjs
 * Story 9.5 Task 3 — Snapshot reproducible de los 33 clusters de folders duplicados Odoo Documents.
 *
 * READ-ONLY: NO escribe nada en Odoo ni Firestore. Solo lee y produce JSON.
 *
 * Output: scripts/audit-output/9-5-folder-clusters-<ts>.json
 *
 * Heurística canónico:
 *  - max childrenCount gana
 *  - tie = min id (más antiguo)
 *
 * Normalizer (debe coincidir con src/lib/odoo/folder-canonical.ts:normalizeFolderName):
 *  - lowercase
 *  - strip diacríticos NFD
 *  - colapsar espacios
 *  - quitar dígitos pegados a letra (MAYO1 → MAYO)
 *  - preserva años (espacio antes del número)
 *
 * Uso: node scripts/audit-9-5-folder-clusters.mjs
 */
import xmlrpc from 'xmlrpc'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { resolve } from 'path'

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
  console.error('[fail] faltan ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_API_KEY')
  process.exit(1)
}

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
  if (!uid) throw new Error('authenticate devolvio falsy')
  return uid
}

async function execKw(uid, model, method, args, kwargs = {}) {
  return call(object, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs])
}

function normalizeFolderName(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/([a-zñ])\d+/g, '$1')
    .trim()
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const startedAt = new Date().toISOString()
  console.log('\n' + '='.repeat(55))
  console.log(`  Audit 9.5 — Folder clusters Odoo Documents`)
  console.log(`  ${startedAt}`)
  console.log('='.repeat(55) + '\n')

  console.log('[1/4] Autenticando...')
  const uid = await auth()
  console.log(`  [ok] uid=${uid}\n`)

  console.log('[2/4] Query documents.document type=folder...')
  const folders = await execKw(uid, 'documents.document', 'search_read',
    [[['type', '=', 'folder']]],
    {
      fields: ['id', 'name', 'folder_id', 'tag_ids', 'shortcut_document_id', 'create_date'],
      limit: 1000,
    },
  )
  console.log(`  [ok] ${folders.length} folders`)
  console.log()

  console.log('[3/4] Calculando children_count por folder (1 call cada uno)...')
  const folderById = new Map()
  for (let i = 0; i < folders.length; i++) {
    const f = folders[i]
    const count = await execKw(uid, 'documents.document', 'search_count',
      [[['folder_id', '=', f.id]]],
    )
    folderById.set(f.id, { ...f, childrenCount: count })
    if ((i + 1) % 20 === 0) {
      console.log(`  [progress] ${i + 1}/${folders.length}`)
      await sleep(500) // ~30 calls/min para no saturar
    }
  }
  console.log(`  [ok] children counts listos`)
  console.log()

  console.log('[4/4] Normalizando + agrupando + canonical heurística...')
  const byKey = new Map()
  for (const f of folderById.values()) {
    if (typeof f.name !== 'string' || f.name.length === 0) continue
    if (f.name.startsWith('_CLEANED_')) continue // skip artifacts spike
    const key = normalizeFolderName(f.name)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(f)
  }

  const clusters = []
  for (const [key, items] of byKey.entries()) {
    if (items.length < 2) continue
    items.sort((a, b) => {
      if (b.childrenCount !== a.childrenCount) return b.childrenCount - a.childrenCount
      return a.id - b.id
    })
    const [canonical, ...duplicates] = items
    clusters.push({
      normalizedKey: key,
      canonical: {
        id: canonical.id,
        name: canonical.name,
        childrenCount: canonical.childrenCount,
        createDate: canonical.create_date,
      },
      duplicates: duplicates.map((d) => ({
        id: d.id,
        name: d.name,
        childrenCount: d.childrenCount,
        createDate: d.create_date,
        currentShortcutDocumentId:
          Array.isArray(d.shortcut_document_id) ? d.shortcut_document_id[0] : (d.shortcut_document_id === false ? null : d.shortcut_document_id ?? null),
        currentTagIds: Array.isArray(d.tag_ids) ? d.tag_ids : [],
      })),
    })
  }

  clusters.sort((a, b) => a.normalizedKey.localeCompare(b.normalizedKey))

  const totalDuplicates = clusters.reduce((s, c) => s + c.duplicates.length, 0)
  console.log(`  [ok] clusters=${clusters.length} duplicados=${totalDuplicates}`)
  console.log()

  const finishedAt = new Date().toISOString()
  const tsCompact = finishedAt.replace(/[-:.]/g, '').slice(0, 14)
  const audit = {
    generatedAt: finishedAt,
    tenant: ODOO_URL,
    totalFolders: folders.length,
    totalClusters: clusters.length,
    totalDuplicates,
    clusters,
  }
  const auditDir = resolve(process.cwd(), 'scripts/audit-output')
  mkdirSync(auditDir, { recursive: true })
  const outPath = resolve(auditDir, `9-5-folder-clusters-${tsCompact}.json`)
  writeFileSync(outPath, JSON.stringify(audit, null, 2), 'utf8')
  console.log(`[done] ${outPath}`)
  console.log(`        totalFolders=${folders.length} clusters=${clusters.length} dup=${totalDuplicates}`)
}

main().catch((e) => {
  console.error('[fail]', e?.message ?? e)
  if (e?.stack) console.error(e.stack)
  process.exit(1)
})
