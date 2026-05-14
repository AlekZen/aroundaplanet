/**
 * setup-9-4-attachment-tag.mjs
 * Story 9.4 Task 1 — Crear tag de attachments en Odoo prod + persistir tagId en Firestore.
 *
 * REGLAS NO NEGOCIABLES:
 * - PROD Odoo. NUNCA unlink. NUNCA modificar campos existentes ajenos.
 * - Idempotente: si el tag ya existe, reusar. NO crear duplicado.
 * - Si ir.attachment.tag no existe en el tenant, fallback a documents.tag.
 * - Si ninguno existe, fallar limpio y NO escribir nada en Firestore.
 * - NO emojis en logs (PowerShell charset). NO acentos en strings ANSI.
 *
 * Uso: node scripts/setup-9-4-attachment-tag.mjs
 * Output: scripts/audit-output/9-4-attachment-tag-setup.json
 *         _bmad-output/implementation-artifacts/runbooks/9-4-attachment-tag-setup.md
 */
import xmlrpc from 'xmlrpc'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { createRequire } from 'module'

// ─── Cargar .env.local ───────────────────────────────────────────────────────
try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const ODOO_URL      = process.env.ODOO_URL
const ODOO_DB       = process.env.ODOO_DB
const ODOO_USERNAME = process.env.ODOO_USERNAME
const ODOO_API_KEY  = process.env.ODOO_API_KEY

if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_API_KEY) {
  console.error('[fail] faltan variables ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_API_KEY')
  process.exit(1)
}

// ─── Firebase Admin SDK ──────────────────────────────────────────────────────
// Importacion dinamica para ESM compatibility con firebase-admin CommonJS
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

// ─── Clientes XML-RPC ────────────────────────────────────────────────────────
const host   = new URL(ODOO_URL).hostname
const mkClient = (p) => xmlrpc.createSecureClient({ host, port: 443, path: p })
const common   = mkClient('/xmlrpc/2/common')
const object   = mkClient('/xmlrpc/2/object')

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
  if (!uid) throw new Error('authenticate devolvio falsy — credenciales invalidas')
  return uid
}

async function execKw(uid, model, method, args, kwargs = {}) {
  return call(object, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs])
}

// ─── Detectar modelo de tags disponible ──────────────────────────────────────
const TAG_NAME = 'aroundaplanet_comprobante'
const CANDIDATE_MODELS = ['ir.attachment.tag', 'documents.tag']

async function detectTagModel(uid) {
  for (const candidate of CANDIDATE_MODELS) {
    try {
      const found = await execKw(uid, 'ir.model', 'search_read',
        [[['model', '=', candidate]]],
        { fields: ['id', 'model', 'name'], limit: 1 },
      )
      if (found.length) {
        console.log(`  [ok] modelo encontrado: ${candidate} (ir.model id=${found[0].id})`)
        return candidate
      }
      console.log(`  [skip] ${candidate} no existe en este tenant`)
    } catch (e) {
      console.log(`  [skip] ${candidate} — error al consultar ir.model: ${e.message}`)
    }
  }
  return null
}

async function main() {
  const startedAt = new Date().toISOString()
  console.log('\n' + '='.repeat(55))
  console.log('  Setup 9.4 — Tag de attachments en Odoo prod')
  console.log('  ' + startedAt)
  console.log('='.repeat(55) + '\n')

  // ── 1. Autenticar ────────────────────────────────────────────────────────
  console.log('[1/5] Autenticando en Odoo...')
  const uid = await auth()
  console.log(`  [ok] uid=${uid}\n`)

  // ── 2. Detectar modelo de tags ────────────────────────────────────────────
  console.log('[2/5] Detectando modelo de tags disponible...')
  const tagModel = await detectTagModel(uid)
  if (!tagModel) {
    console.error('[fail] ninguno de los modelos de tags existe en este tenant:',
      CANDIDATE_MODELS.join(', '))
    console.error('  NO se escribe nada en Firestore.')
    process.exit(1)
  }
  console.log()

  // ── 3. Verificar schema del modelo (fields_get) ────────────────────────────
  console.log('[3/5] Verificando schema del modelo de tags...')
  const fields = await execKw(uid, tagModel, 'fields_get', [],
    { attributes: ['type', 'required', 'string'] },
  )
  const fieldNames = Object.keys(fields)
  console.log(`  campos disponibles: ${fieldNames.slice(0, 10).join(', ')}${fieldNames.length > 10 ? '...' : ''}`)
  const hasName = 'name' in fields
  if (!hasName) {
    throw new Error(`El modelo ${tagModel} no tiene campo 'name' — revisar schema`)
  }
  console.log(`  [ok] campo 'name' confirmado (type=${fields.name?.type}, required=${fields.name?.required})\n`)

  // ── 4. Buscar o crear el tag ────────────────────────────────────────────────
  console.log(`[4/5] Buscando tag '${TAG_NAME}' en ${tagModel}...`)
  const existing = await execKw(uid, tagModel, 'search_read',
    [[['name', '=', TAG_NAME]]],
    { fields: ['id', 'name'], limit: 1 },
  )

  let tagId
  let action
  if (existing.length) {
    tagId  = existing[0].id
    action = 'reused'
    console.log(`  [ok] tag ya existe — reutilizando id=${tagId} (NO se crea duplicado)`)
  } else {
    console.log(`  tag no existe — creando...`)
    const newId = await execKw(uid, tagModel, 'create', [{ name: TAG_NAME }])
    tagId  = newId
    action = 'created'
    console.log(`  [ok] tag creado id=${tagId}`)

    // Verificar post-create
    const [created] = await execKw(uid, tagModel, 'read',
      [[tagId]],
      { fields: ['id', 'name'] },
    )
    if (!created || created.name !== TAG_NAME) {
      throw new Error(`Post-create verify fallo — tag leido: ${JSON.stringify(created)}`)
    }
    console.log(`  [ok] verify post-create: name='${created.name}' id=${created.id}`)
  }
  console.log()
  console.log(`[OK] tagId=${tagId} model=${tagModel} action=${action}`)
  console.log()

  // ── 5. Persistir en Firestore appConfig/odoo ─────────────────────────────
  console.log('[5/5] Persistiendo en Firestore appConfig/odoo...')
  await db.collection('appConfig').doc('odoo').set({
    attachmentReceiptTagId:    tagId,
    attachmentReceiptTagName:  TAG_NAME,
    attachmentReceiptTagModel: tagModel,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
  console.log('  [ok] Firestore appConfig/odoo actualizado con merge')
  console.log()

  // ── Persistir JSON de output ───────────────────────────────────────────────
  const finishedAt   = new Date().toISOString()
  const jsonPayload  = {
    timestamp:        finishedAt,
    tenant:           ODOO_URL,
    tagId,
    tagModel,
    tagName:          TAG_NAME,
    action,
    firestoreUpdated: true,
    uid,
    startedAt,
    finishedAt,
  }

  const auditDir  = resolve(process.cwd(), 'scripts/audit-output')
  mkdirSync(auditDir, { recursive: true })
  const jsonPath  = resolve(auditDir, '9-4-attachment-tag-setup.json')
  writeFileSync(jsonPath, JSON.stringify(jsonPayload, null, 2), 'utf8')
  console.log(`  [json] ${jsonPath}`)

  // ── Escribir runbook log ────────────────────────────────────────────────────
  const runbookDir  = resolve(process.cwd(), '_bmad-output/implementation-artifacts/runbooks')
  mkdirSync(runbookDir, { recursive: true })
  const runbookPath = resolve(runbookDir, '9-4-attachment-tag-setup.md')

  const md = `# Runbook 9.4 Task 1 — Setup Tag de Attachments en Odoo

## Metadatos

| Campo | Valor |
|-------|-------|
| Fecha | \`${finishedAt}\` |
| Comando | \`node scripts/setup-9-4-attachment-tag.mjs\` |
| Entorno | Produccion (${ODOO_URL}) |
| auth uid | ${uid} |

## Resultado

| Campo | Valor |
|-------|-------|
| Modelo usado | \`${tagModel}\` |
| Tag name | \`${TAG_NAME}\` |
| tagId | \`${tagId}\` |
| Accion | \`${action}\` |
| Firestore actualizado | Si — \`appConfig/odoo\` con merge |

## Campos escritos en Firestore \`appConfig/odoo\`

\`\`\`json
{
  "attachmentReceiptTagId": ${tagId},
  "attachmentReceiptTagName": "${TAG_NAME}",
  "attachmentReceiptTagModel": "${tagModel}",
  "updatedAt": "<serverTimestamp>"
}
\`\`\`

## Leccion operativa

### Rotar el tag si cambia el name

Si en el futuro se necesita renombrar el tag (p.ej. de \`aroundaplanet_comprobante\` a otro nombre),
el proceso correcto es:

1. Crear el nuevo tag via \`${tagModel}.create({name: 'nuevo_nombre'})\` — obtener el nuevo \`tagId\`.
2. Actualizar \`appConfig/odoo.attachmentReceiptTagId\` con el nuevo id.
3. Actualizar \`appConfig/odoo.attachmentReceiptTagName\` con el nuevo nombre.
4. Los attachments existentes con el tag viejo NO se deshabilitan (Odoo conserva el historial).
5. El helper TypeScript \`getReceiptTagId()\` invalida su cache al detectar que \`attachmentReceiptTagId\` cambio en Firestore.

### Invalidar cache del helper TypeScript futuro

El helper \`getReceiptTagId()\` (Task siguiente de 9.4) cachea el tagId en memoria por ~10 minutos
para evitar leer Firestore en cada operacion. Para forzar invalidacion inmediata:

1. Redeployer la funcion/servidor (Cloud Run recicla instancias).
2. O bien: cambiar \`attachmentReceiptTagId\` a \`-1\` en Firestore y luego al valor correcto
   — el helper detectara el -1 como invalido y releeera en la siguiente llamada.

### Si ningun modelo de tags existe

Los modelos probados en orden son: ${CANDIDATE_MODELS.join(', ')}.
Si un tenant nuevo no tiene ninguno, instalar el modulo "Documents" de Odoo (Configuracion > Apps)
y volver a ejecutar este script. El script es idempotente y seguro de re-ejecutar.

## Output JSON

Archivo: \`scripts/audit-output/9-4-attachment-tag-setup.json\`
`

  writeFileSync(runbookPath, md, 'utf8')
  console.log(`  [log]  ${runbookPath}`)

  console.log('\n' + '='.repeat(55))
  console.log(`  DONE — tagId=${tagId} model=${tagModel} action=${action}`)
  console.log('='.repeat(55) + '\n')
}

main().catch(e => {
  console.error('[fail]', e?.message ?? e)
  if (e?.stack) console.error(e.stack)
  process.exit(1)
})
