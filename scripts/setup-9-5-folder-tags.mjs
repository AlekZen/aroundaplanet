/**
 * setup-9-5-folder-tags.mjs
 * Story 9.5 Task 1 — Tags productivos folder-canonico / folder-duplicado + cleanup spike artifacts.
 *
 * Estrategia:
 *  - Si tags productivos (`folder-canonico`, `folder-duplicado`) ya existen → reusa por id.
 *  - Si no existen y los spike (`spike_9_5_canonico_*_CLEANED`, `spike_9_5_duplicado_*_CLEANED`)
 *    existen → los renombra (write name).
 *  - Si no hay nada → crea desde cero.
 *  - Tag spike H8 (`spike_9_5_test_*_no_facet_CLEANED`, id=48) → rename `_CLEANED_<ts>_spike_h8_descartado`.
 *  - Custom field id=22941 (`x_spike_9_5v2_*_canon` sobre `documents.document`) → rename `x_cleaned_9_5_<ts>`.
 *  - Persistir folderCanonicoTagId + folderDuplicadoTagId en `appConfig/odoo`.
 *
 * Idempotente. NUNCA unlink. NUNCA action_post. NO emojis ni acentos en logs (PowerShell charset).
 *
 * Uso: node scripts/setup-9-5-folder-tags.mjs [--dry-run]
 */
import xmlrpc from 'xmlrpc'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { createRequire } from 'module'

// ─── .env.local loader ────────────────────────────────────────────────
try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const DRY_RUN = process.argv.includes('--dry-run')
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
let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
} catch (e) {
  console.error('[fail] no se pudo leer Firebase Admin SDK key:', e.message)
  process.exit(1)
}

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

const TAG_CANONICO = 'folder-canonico'
const TAG_DUPLICADO = 'folder-duplicado'
const SPIKE_FIELD_ID = 22941
const SPIKE_TAG_H8_PREFIX = 'spike_9_5_test_'
const SPIKE_TAG_CANONICO_PREFIX = 'spike_9_5_canonico_'
const SPIKE_TAG_DUPLICADO_PREFIX = 'spike_9_5_duplicado_'

async function resolveTagByName(uid, name) {
  const rows = await execKw(uid, 'documents.tag', 'search_read',
    [[['name', '=', name]]],
    { fields: ['id', 'name'], limit: 1 },
  )
  return rows.length ? rows[0].id : null
}

async function findSpikeTag(uid, prefix) {
  const rows = await execKw(uid, 'documents.tag', 'search_read',
    [[['name', '=like', prefix + '%']]],
    { fields: ['id', 'name'], limit: 1 },
  )
  return rows.length ? rows[0] : null
}

async function ensureProductionTag(uid, prodName, spikePrefix) {
  const existingId = await resolveTagByName(uid, prodName)
  if (existingId !== null) {
    console.log(`  [ok] '${prodName}' ya existe id=${existingId} (reuse)`)
    return { id: existingId, action: 'reused' }
  }
  const spike = await findSpikeTag(uid, spikePrefix)
  if (spike) {
    console.log(`  spike encontrado id=${spike.id} name='${spike.name}' → rename a '${prodName}'`)
    if (!DRY_RUN) {
      await execKw(uid, 'documents.tag', 'write', [[spike.id], { name: prodName }])
    }
    return { id: spike.id, action: 'renamed' }
  }
  console.log(`  ni '${prodName}' ni spike '${spikePrefix}*' existen → create`)
  if (DRY_RUN) return { id: null, action: 'create-dry-run' }
  const newId = await execKw(uid, 'documents.tag', 'create', [{ name: prodName }])
  return { id: newId, action: 'created' }
}

async function cleanupSpikeArtifacts(uid, ts) {
  console.log('[cleanup] tag H8 + field 22941')
  const h8 = await findSpikeTag(uid, SPIKE_TAG_H8_PREFIX)
  if (h8 && !h8.name.includes('_descartado')) {
    const newName = `_CLEANED_${ts}_spike_h8_descartado`
    console.log(`  tag H8 id=${h8.id} '${h8.name}' → '${newName}'`)
    if (!DRY_RUN) {
      await execKw(uid, 'documents.tag', 'write', [[h8.id], { name: newName }])
    }
  } else {
    console.log('  tag H8: no encontrado o ya limpio (skip)')
  }

  try {
    const fieldRows = await execKw(uid, 'ir.model.fields', 'read',
      [[SPIKE_FIELD_ID]],
      { fields: ['id', 'name', 'model'] },
    )
    if (fieldRows.length) {
      const field = fieldRows[0]
      if (field.name && !field.name.startsWith('x_cleaned_')) {
        const newFieldName = `x_cleaned_9_5_${ts}`
        console.log(`  field 22941 '${field.name}' → '${newFieldName}'`)
        if (!DRY_RUN) {
          await execKw(uid, 'ir.model.fields', 'write',
            [[SPIKE_FIELD_ID], { name: newFieldName }],
          )
        }
      } else {
        console.log('  field 22941: ya limpio (skip)')
      }
    }
  } catch (e) {
    console.log(`  field 22941: error al leer (probable ACL o no existe) — ${e.message}`)
  }
}

async function main() {
  const startedAt = new Date().toISOString()
  const tsCompact = startedAt.replace(/[-:.]/g, '').slice(0, 14)
  console.log('\n' + '='.repeat(55))
  console.log(`  Setup 9.5 — Tags productivos folder-canonico / folder-duplicado`)
  console.log(`  ${startedAt}${DRY_RUN ? '  [DRY-RUN]' : ''}`)
  console.log('='.repeat(55) + '\n')

  console.log('[1/4] Autenticando...')
  const uid = await auth()
  console.log(`  [ok] uid=${uid}\n`)

  console.log('[2/4] Asegurando tag folder-canonico...')
  const canonico = await ensureProductionTag(uid, TAG_CANONICO, SPIKE_TAG_CANONICO_PREFIX)
  console.log()

  console.log('[3/4] Asegurando tag folder-duplicado...')
  const duplicado = await ensureProductionTag(uid, TAG_DUPLICADO, SPIKE_TAG_DUPLICADO_PREFIX)
  console.log()

  console.log('[4/4] Cleanup spike artifacts...')
  await cleanupSpikeArtifacts(uid, tsCompact)
  console.log()

  if (!DRY_RUN && canonico.id !== null && duplicado.id !== null) {
    console.log('Persistiendo en Firestore appConfig/odoo...')
    await db.collection('appConfig').doc('odoo').set({
      folderCanonicoTagId: canonico.id,
      folderDuplicadoTagId: duplicado.id,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    console.log(`  [ok] folderCanonicoTagId=${canonico.id} folderDuplicadoTagId=${duplicado.id}\n`)
  } else if (DRY_RUN) {
    console.log('Skipping Firestore write (dry-run)\n')
  }

  const finishedAt = new Date().toISOString()
  const audit = {
    timestamp: finishedAt,
    tenant: ODOO_URL,
    dryRun: DRY_RUN,
    canonico,
    duplicado,
    cleanup: { spikeFieldId: SPIKE_FIELD_ID },
    uid,
  }
  const auditDir = resolve(process.cwd(), 'scripts/audit-output')
  mkdirSync(auditDir, { recursive: true })
  writeFileSync(
    resolve(auditDir, '9-5-folder-tags-setup.json'),
    JSON.stringify(audit, null, 2),
    'utf8',
  )
  console.log('[done] scripts/audit-output/9-5-folder-tags-setup.json')
}

main().catch((e) => {
  console.error('[fail]', e?.message ?? e)
  if (e?.stack) console.error(e.stack)
  process.exit(1)
})
