/**
 * execute-9-7-runbook.mjs
 * Runbook 9.7 — Crear 5 custom fields en account.payment vía Odoo XML-RPC prod.
 *
 * REGLAS NO NEGOCIABLES:
 * - PROD Odoo. NUNCA unlink. NUNCA modificar campos existentes ajenos.
 * - Idempotente: si un field ya existe, skip y loggear.
 * - En caso de fallo parcial: NO revertir creados. Reportar estado parcial.
 *
 * Uso: node scripts/execute-9-7-runbook.mjs
 * Output: scripts/audit-output/9-7-execution-result.json
 *         _bmad-output/implementation-artifacts/runbooks/9-7-execution-log.md
 */
import xmlrpc from 'xmlrpc'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'

// ─── Cargar .env.local (igual que spike-9-0b) ───────────────────────────────
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
  console.error('[fail] faltan variables ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_API_KEY')
  process.exit(1)
}

// ─── Clientes XML-RPC ────────────────────────────────────────────────────────
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
  if (!uid) throw new Error('authenticate devolvió falsy — credenciales inválidas')
  return uid
}

async function execKw(uid, model, method, args, kwargs = {}) {
  return call(object, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs])
}

// ─── Definición de fields a crear ────────────────────────────────────────────
// (se completa más abajo para many2one que necesita model_id dinámico)
const FIELD_SPECS = [
  {
    name: 'x_firebase_payment_id',
    ttype: 'char',
    field_description: 'Firebase Payment ID',
    index: true,
    help: 'UID del pago Firestore vinculado para sync bidireccional Epic 9',
  },
  {
    name: 'x_firebase_agent_uid',
    ttype: 'char',
    field_description: 'Firebase Agent UID',
    help: 'UID Firebase del agente que registró el pago',
  },
  {
    name: 'x_ocr_confidence',
    ttype: 'float',
    field_description: 'OCR Confidence',
    help: 'Confianza OCR del comprobante (0-1) si vino de Firestore con OCR Gemini',
  },
  // x_canonical_payment_id se agrega abajo con model_id dinámico
  {
    name: 'x_dup_status',
    ttype: 'selection',
    field_description: 'Dup Status',
    selection: "[('canonico', 'Canónico'), ('secundario', 'Secundario')]",
    help: 'Estado de deduplicación. Null = no es duplicado.',
  },
]

async function main() {
  const startedAt = new Date().toISOString()
  console.log(`\n═══════════════════════════════════════════════════`)
  console.log(`  Runbook 9.7 — Custom fields en account.payment`)
  console.log(`  ${startedAt}`)
  console.log(`═══════════════════════════════════════════════════\n`)

  // ── 1. Autenticar ──────────────────────────────────────────────────────────
  console.log('[1/5] Autenticando en Odoo...')
  const uid = await auth()
  console.log(`  ✓ uid=${uid}\n`)

  // ── 2. Obtener model_id de account.payment (para many2one) ─────────────────
  console.log('[2/5] Buscando ir.model id de account.payment...')
  const models = await execKw(uid, 'ir.model', 'search_read',
    [[['model', '=', 'account.payment']]],
    { fields: ['id', 'model', 'name'], limit: 1 },
  )
  if (!models.length) throw new Error('ir.model account.payment no encontrado — verificar permisos')
  const accountPaymentModelId = models[0].id
  console.log(`  ✓ ir.model id=${accountPaymentModelId} (${models[0].name})\n`)

  // Agregar el many2one con model_id resuelto
  const allFieldSpecs = [
    ...FIELD_SPECS.slice(0, 3), // char, char, float
    {
      name: 'x_canonical_payment_id',
      ttype: 'many2one',
      field_description: 'Pago Canónico',
      relation: 'account.payment',
      model_id: accountPaymentModelId,
      help: 'Pago canónico cuando este es duplicado interno (Story 9.1 PARTE B)',
    },
    FIELD_SPECS[3], // x_dup_status selection
  ]

  // ── 3. Dry-run check: ¿cuáles ya existen? ─────────────────────────────────
  console.log('[3/5] Dry-run check — verificando fields existentes...')
  const fieldNames = allFieldSpecs.map(f => f.name)
  const existingFields = await execKw(uid, 'ir.model.fields', 'search_read',
    [[['model', '=', 'account.payment'], ['name', 'in', fieldNames]]],
    { fields: ['id', 'name', 'ttype', 'state', 'relation', 'selection'], limit: 20 },
  )
  const existingMap = new Map(existingFields.map(f => [f.name, f]))
  for (const spec of allFieldSpecs) {
    const exists = existingMap.has(spec.name)
    console.log(`  ${exists ? '⚠️  EXISTE (skip)' : '○  nuevo'}  ${spec.name} (${spec.ttype})`)
  }
  console.log()

  // ── 4. Crear fields que NO existen ────────────────────────────────────────
  console.log('[4/5] Creando fields faltantes...')
  const results = []

  for (const spec of allFieldSpecs) {
    const existing = existingMap.get(spec.name)
    if (existing) {
      console.log(`  [skip] ${spec.name} — ya existe (id=${existing.id})`)
      results.push({
        name: spec.name,
        status: 'skipped',
        reason: 'field ya existía en account.payment',
        odoo_id: existing.id,
        ttype: existing.ttype,
        state: existing.state,
      })
      continue
    }

    // Construir vals para ir.model.fields.create
    const vals = {
      model_id: accountPaymentModelId,
      name: spec.name,
      ttype: spec.ttype,
      field_description: spec.field_description,
      state: 'manual',
    }
    if (spec.help) vals.help = spec.help
    if (spec.index) vals.index = spec.index
    if (spec.relation) vals.relation = spec.relation
    if (spec.selection) vals.selection = spec.selection

    try {
      console.log(`  [create] ${spec.name} (${spec.ttype})...`)
      const newId = await execKw(uid, 'ir.model.fields', 'create', [vals])
      console.log(`    ✓ creado id=${newId}`)

      // Post-create: leer y verificar
      const [created] = await execKw(uid, 'ir.model.fields', 'read',
        [[newId]],
        { fields: ['id', 'name', 'ttype', 'state', 'relation', 'selection', 'help', 'index'] },
      )
      const stateOk = created.state === 'manual'
      const ttypeOk = created.ttype === spec.ttype
      const relationOk = spec.relation ? created.relation === spec.relation : true
      const verifyOk = stateOk && ttypeOk && relationOk

      console.log(`    verify: state=${created.state} ttype=${created.ttype} relation=${created.relation || '-'} ok=${verifyOk}`)

      results.push({
        name: spec.name,
        status: 'created',
        odoo_id: newId,
        ttype: created.ttype,
        state: created.state,
        relation: created.relation || null,
        selection: created.selection || null,
        help: created.help || null,
        index: created.index || false,
        verify: { stateOk, ttypeOk, relationOk, allOk: verifyOk },
      })
    } catch (err) {
      const errorMsg = err?.message ?? String(err)
      console.error(`    ✗ ERROR creando ${spec.name}: ${errorMsg}`)
      results.push({
        name: spec.name,
        status: 'error',
        error: errorMsg,
        ttype: spec.ttype,
      })
    }
  }
  console.log()

  // ── 5. Verificación final con los 5 fields ─────────────────────────────────
  console.log('[5/5] Verificación final — re-leyendo los 5 fields...')
  const allNames = [
    'x_firebase_payment_id',
    'x_firebase_agent_uid',
    'x_ocr_confidence',
    'x_canonical_payment_id',
    'x_dup_status',
  ]
  const finalCheck = await execKw(uid, 'ir.model.fields', 'search_read',
    [[['model', '=', 'account.payment'], ['name', 'in', allNames]]],
    { fields: ['id', 'name', 'ttype', 'state', 'relation', 'selection'], limit: 20 },
  )
  const finalMap = new Map(finalCheck.map(f => [f.name, f]))
  console.log()
  console.log('  === Custom fields runbook 9.7 en account.payment ===')
  for (const n of allNames) {
    const f = finalMap.get(n)
    console.log(`  ${f ? '✅' : '❌'} ${n}${f ? ` (id=${f.id} ttype=${f.ttype} state=${f.state})` : ''}`)
  }
  console.log()

  // ── Persistir resultados ───────────────────────────────────────────────────
  const finishedAt = new Date().toISOString()

  const created = results.filter(r => r.status === 'created')
  const skipped = results.filter(r => r.status === 'skipped')
  const errors = results.filter(r => r.status === 'error')

  const jsonOut = {
    runbook: '9.7',
    startedAt,
    finishedAt,
    odoo_url: ODOO_URL,
    uid,
    accountPaymentModelId,
    summary: {
      total: results.length,
      created: created.length,
      skipped: skipped.length,
      errors: errors.length,
    },
    fields: results,
    finalVerification: allNames.map(n => ({
      name: n,
      exists: finalMap.has(n),
      odoo_id: finalMap.get(n)?.id ?? null,
      ttype: finalMap.get(n)?.ttype ?? null,
      state: finalMap.get(n)?.state ?? null,
    })),
  }

  // JSON output
  const jsonPath = resolve(process.cwd(), 'scripts/audit-output/9-7-execution-result.json')
  writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2), 'utf8')
  console.log(`  [json] ${jsonPath}`)

  // Markdown log
  const logDir = resolve(process.cwd(), '_bmad-output/implementation-artifacts/runbooks')
  mkdirSync(logDir, { recursive: true })
  const logPath = resolve(logDir, '9-7-execution-log.md')

  const fieldRows = results.map(r => {
    const icon = r.status === 'created' ? '✅ creado' : r.status === 'skipped' ? '⚠️ skip' : '❌ error'
    const id = r.odoo_id ?? '-'
    const extra = r.error ? ` ERROR: ${r.error}` : r.verify ? ` verify.allOk=${r.verify.allOk}` : ''
    return `| ${r.name} | ${r.ttype} | ${icon} | ${id} |${extra ? ` ${extra}` : ''}`
  }).join('\n')

  const finalRows = jsonOut.finalVerification.map(v =>
    `| ${v.name} | ${v.exists ? '✅' : '❌'} | ${v.odoo_id ?? '-'} | ${v.ttype ?? '-'} | ${v.state ?? '-'} |`
  ).join('\n')

  const md = `# Runbook 9.7 — Execution Log

## Metadatos

| Campo | Valor |
|-------|-------|
| Timestamp inicio | \`${startedAt}\` |
| Timestamp fin | \`${finishedAt}\` |
| Odoo URL | ${ODOO_URL} |
| auth uid | ${uid} |
| ir.model id (account.payment) | ${accountPaymentModelId} |

## Resumen

| Métrica | Valor |
|---------|-------|
| Fields procesados | ${results.length} |
| Creados | ${created.length} |
| Skipped (ya existían) | ${skipped.length} |
| Errores | ${errors.length} |

## Detalle por Field

| name | ttype | status | Odoo ID |
|------|-------|--------|---------|
${fieldRows}

## IDs Odoo creados (para soft-rollback si se necesita)

${created.length ? created.map(r => `- **${r.name}**: id=${r.odoo_id} (ir.model.fields)`).join('\n') : '_Ninguno creado en esta ejecución (todos skipped o error)_'}

## Verificación Final

| field | existe | id | ttype | state |
|-------|--------|----|-------|-------|
${finalRows}

## Observaciones

${errors.length ? errors.map(e => `- ❌ **${e.name}**: ${e.error}`).join('\n') : '- Sin errores de creación.'}
${skipped.length ? skipped.map(s => `- ⚠️ **${s.name}** ya existía con id=${s.odoo_id}, no fue modificado.`).join('\n') : ''}

## Soft-rollback (solo si orquestador lo pide)

Para revertir fields creados, ejecutar en Odoo shell (NO aquí):
\`\`\`python
# SOLO ejecutar si el orquestador lo solicita explícitamente
env['ir.model.fields'].browse([${created.map(r => r.odoo_id).join(', ')}]).unlink()
\`\`\`
`

  writeFileSync(logPath, md, 'utf8')
  console.log(`  [log]  ${logPath}`)

  console.log(`\n═══════════════════════════════════════════════════`)
  console.log(`  DONE — creados=${created.length} skipped=${skipped.length} errores=${errors.length}`)
  console.log(`═══════════════════════════════════════════════════\n`)
}

main().catch(e => {
  console.error('[fail]', e?.message ?? e)
  if (e?.stack) console.error(e.stack)
  process.exit(1)
})
