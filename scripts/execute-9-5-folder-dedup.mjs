/**
 * execute-9-5-folder-dedup.mjs
 * Story 9.5 Task 5 — Aplica shortcut_document_id + tag folder-duplicado / folder-canonico
 * sobre los 33 clusters identificados por audit-9-5-folder-clusters.mjs.
 *
 * Estricto:
 *  - NO unlink, NO move docs, NO action_post.
 *  - Idempotente: skip writes ya aplicadas.
 *  - --dry-run obligatorio antes del run real.
 *  - Rate limit: max ~30 writes/min (sleep 2s entre escrituras).
 *  - Log a folderDedupLog/{normalizedKey}.
 *
 * Uso:
 *   node scripts/execute-9-5-folder-dedup.mjs --snapshot=scripts/audit-output/9-5-folder-clusters-<ts>.json --dry-run
 *   node scripts/execute-9-5-folder-dedup.mjs --snapshot=...
 */
import xmlrpc from 'xmlrpc'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { createRequire } from 'module'

try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const snapshotArg = args.find((a) => a.startsWith('--snapshot='))
const snapshotPath = snapshotArg ? snapshotArg.slice('--snapshot='.length) : null

if (!snapshotPath) {
  console.error('[fail] --snapshot=<path> requerido')
  process.exit(1)
}

const ODOO_URL = process.env.ODOO_URL
const ODOO_DB = process.env.ODOO_DB
const ODOO_USERNAME = process.env.ODOO_USERNAME
const ODOO_API_KEY = process.env.ODOO_API_KEY

if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_API_KEY) {
  console.error('[fail] faltan ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_API_KEY')
  process.exit(1)
}

const require = createRequire(import.meta.url)
const admin = require('firebase-admin')
const serviceAccountPath = resolve(
  process.cwd(),
  '.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json',
)
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}
const db = admin.firestore()
const FieldValue = admin.firestore.FieldValue

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

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function writeWithRetry(uid, model, ids, vals, label) {
  const delays = [1000, 2000, 4000]
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      await execKw(uid, model, 'write', [ids, vals])
      return
    } catch (e) {
      console.warn(`  [retry ${attempt}] ${label} — ${e.message}`)
      if (attempt < delays.length) await sleep(delays[attempt])
      else throw e
    }
  }
}

function arraysEqualSet(a, b) {
  if (a.length !== b.length) return false
  const sa = new Set(a)
  for (const x of b) if (!sa.has(x)) return false
  return true
}

async function main() {
  const startedAt = new Date().toISOString()
  console.log('\n' + '='.repeat(55))
  console.log(`  Execute 9.5 — Folder dedup writes (shortcut + tags)`)
  console.log(`  ${startedAt}${DRY_RUN ? '  [DRY-RUN]' : ''}`)
  console.log('='.repeat(55) + '\n')

  console.log('[1/5] Leyendo snapshot...')
  const snapshot = JSON.parse(readFileSync(resolve(snapshotPath), 'utf8'))
  console.log(`  [ok] ${snapshot.clusters.length} clusters / ${snapshot.totalDuplicates} duplicados`)
  console.log()

  console.log('[2/5] Leyendo tags productivos desde appConfig/odoo...')
  const cfgSnap = await db.collection('appConfig').doc('odoo').get()
  const cfg = cfgSnap.exists ? cfgSnap.data() : null
  const canonicoTagId = cfg?.folderCanonicoTagId
  const duplicadoTagId = cfg?.folderDuplicadoTagId
  if (!canonicoTagId || !duplicadoTagId) {
    console.error('[fail] appConfig/odoo.folderCanonicoTagId o folderDuplicadoTagId NO definidos')
    console.error('       Corre primero: node scripts/setup-9-5-folder-tags.mjs')
    process.exit(1)
  }
  console.log(`  [ok] canonicoTagId=${canonicoTagId} duplicadoTagId=${duplicadoTagId}\n`)

  console.log('[3/5] Autenticando Odoo...')
  const uid = await auth()
  console.log(`  [ok] uid=${uid}\n`)

  console.log('[4/5] Procesando clusters...')
  let writesCanonical = 0
  let writesDuplicate = 0
  let skipsCanonical = 0
  let skipsDuplicate = 0
  const logs = []

  for (const cluster of snapshot.clusters) {
    const { normalizedKey, canonical, duplicates } = cluster
    console.log(`\n  [cluster] ${normalizedKey}`)
    console.log(`    canonical id=${canonical.id} '${canonical.name}' (${canonical.childrenCount} children)`)

    // Canonical: agregar tag folder-canonico, asegurar shortcut null (NO debe ser shortcut de nadie).
    // Releer estado actual para no pisar cambios externos.
    const canonRow = await execKw(uid, 'documents.document', 'read',
      [[canonical.id]],
      { fields: ['id', 'name', 'tag_ids'] },
    )
    if (canonRow.length === 0) {
      console.log(`    [warn] canonical id=${canonical.id} no existe — skip cluster`)
      logs.push({
        normalizedKey,
        canonicalId: canonical.id,
        canonicalName: canonical.name,
        canonicalChildrenCount: canonical.childrenCount,
        duplicateIds: duplicates.map((d) => d.id),
        duplicateNames: duplicates.map((d) => d.name),
        duplicatesChildrenCount: duplicates.reduce((s, d) => s + (d.childrenCount ?? 0), 0),
        totalChildrenInDuplicates: duplicates.reduce((s, d) => s + (d.childrenCount ?? 0), 0),
        executedAt: new Date().toISOString(),
        executedBy: 'script-9-5-execute',
        snapshotFile: snapshotPath,
        skippedReason: 'canonical_not_found',
      })
      continue
    }
    const canonTags = Array.isArray(canonRow[0].tag_ids) ? canonRow[0].tag_ids : []
    const canonDesired = Array.from(
      new Set(canonTags.filter((t) => t !== duplicadoTagId).concat(canonicoTagId)),
    )
    if (arraysEqualSet(canonTags, canonDesired)) {
      console.log(`    canonical: tags ya correctos (skip)`)
      skipsCanonical++
    } else {
      console.log(`    canonical: write tag_ids = [${canonDesired.join(',')}]${DRY_RUN ? ' (dry-run)' : ''}`)
      if (!DRY_RUN) {
        await writeWithRetry(uid, 'documents.document', [canonical.id],
          { tag_ids: [[6, 0, canonDesired]] },
          `canonical id=${canonical.id}`,
        )
        await sleep(2000)
      }
      writesCanonical++
    }

    // NOTA: Odoo 18 rechaza `write shortcut_document_id` post-create (error literal:
    // "No puede cambiar el documento objetivo de los atajos"). Pivote a Camino C:
    // solo tags planos `folder-canonico` / `folder-duplicado`. El link semántico
    // dup→canon queda en el normalizedKey + log Firestore.
    const processedDuplicates = []
    for (const dup of duplicates) {
      const dupRow = await execKw(uid, 'documents.document', 'read',
        [[dup.id]],
        { fields: ['id', 'name', 'tag_ids'] },
      )
      if (dupRow.length === 0) {
        console.log(`    [warn] dup id=${dup.id} no existe — skip`)
        continue
      }
      const dupTags = Array.isArray(dupRow[0].tag_ids) ? dupRow[0].tag_ids : []
      const desiredTags = Array.from(
        new Set(dupTags.filter((t) => t !== canonicoTagId).concat(duplicadoTagId)),
      )
      const tagsOk = arraysEqualSet(dupTags, desiredTags)
      if (tagsOk) {
        console.log(`    dup id=${dup.id}: idempotente (skip)`)
        skipsDuplicate++
        processedDuplicates.push({ id: dup.id, action: 'skip', name: dup.name })
        continue
      }
      const vals = { tag_ids: [[6, 0, desiredTags]] }
      console.log(`    dup id=${dup.id}: write ${JSON.stringify(vals)}${DRY_RUN ? ' (dry-run)' : ''}`)
      if (!DRY_RUN) {
        await writeWithRetry(uid, 'documents.document', [dup.id], vals, `dup id=${dup.id}`)
        await sleep(2000)
      }
      writesDuplicate++
      processedDuplicates.push({ id: dup.id, action: 'write', name: dup.name })
    }

    logs.push({
      normalizedKey,
      canonicalId: canonical.id,
      canonicalName: canonical.name,
      canonicalChildrenCount: canonical.childrenCount,
      duplicateIds: processedDuplicates.map((d) => d.id),
      duplicateNames: processedDuplicates.map((d) => d.name),
      duplicatesChildrenCount: duplicates.reduce((s, d) => s + (d.childrenCount ?? 0), 0),
      totalChildrenInDuplicates: duplicates.reduce((s, d) => s + (d.childrenCount ?? 0), 0),
      executedAt: new Date().toISOString(),
      executedBy: 'script-9-5-execute',
      snapshotFile: snapshotPath,
    })
  }
  console.log()
  console.log(`  [resumen] canonicales: ${writesCanonical} writes / ${skipsCanonical} skips`)
  console.log(`            duplicados:  ${writesDuplicate} writes / ${skipsDuplicate} skips`)
  console.log()

  if (!DRY_RUN) {
    console.log('[5/5] Persistiendo folderDedupLog/...')
    for (const log of logs) {
      await db.collection('folderDedupLog').doc(log.normalizedKey).set({
        ...log,
        executedAt: FieldValue.serverTimestamp(),
      }, { merge: false })
    }
    console.log(`  [ok] ${logs.length} docs escritos\n`)
  } else {
    console.log('[5/5] Skip folderDedupLog (dry-run)\n')
  }

  const finishedAt = new Date().toISOString()
  const tsCompact = finishedAt.replace(/[-:.]/g, '').slice(0, 14)
  const audit = {
    startedAt,
    finishedAt,
    dryRun: DRY_RUN,
    snapshotPath,
    clustersProcessed: snapshot.clusters.length,
    writesCanonical,
    writesDuplicate,
    skipsCanonical,
    skipsDuplicate,
    logs: logs.length,
  }
  const auditDir = resolve(process.cwd(), 'scripts/audit-output')
  mkdirSync(auditDir, { recursive: true })
  writeFileSync(
    resolve(auditDir, `9-5-execute-${tsCompact}.json`),
    JSON.stringify(audit, null, 2),
    'utf8',
  )
  console.log(`[done] scripts/audit-output/9-5-execute-${tsCompact}.json`)
}

main().catch((e) => {
  console.error('[fail]', e?.message ?? e)
  if (e?.stack) console.error(e.stack)
  process.exit(1)
})
