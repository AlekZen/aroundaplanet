/**
 * spike-10-1-extract-legal-text.mjs
 * Descarga las 5 plantillas .docx piloto de Odoo Documents y extrae texto plano con mammoth.
 * Output:
 *   - scripts/audit-output/10-1-legal-text/{templateKey}.txt   (texto plano)
 *   - scripts/audit-output/10-1-legal-text/{templateKey}.docx  (binario original p/ Paloma)
 *   - _bmad-output/implementation-artifacts/spikes/10-1-legal-text-extraction.md (reporte)
 *
 * NO escribe en Odoo. Solo lectura.
 */
import xmlrpc from 'xmlrpc'
import mammoth from 'mammoth'
import { writeFileSync } from 'fs'

const ODOO_DB = 'aroundaplanet'
const ODOO_USERNAME = 'noelnumata@gmail.com'
const ODOO_API_KEY = 'bd9e865a66e12c855f050521cfe2ef00bb1df7ad'
const HOST = 'aroundaplanet.odoo.com'

const PILOT = [
  { id: 532, key: 'vuelta-al-mundo', label: 'VUELTA AL MUNDO 2024' },
  { id: 232, key: 'asia', label: 'ASIA CONTRATO' },
  { id: 221, key: 'europa-septiembre', label: 'EUROPA SEPTIEMBRE CONTRATO' },
  { id: 233, key: 'colombia-mayo', label: 'COLOMBIA MAYO CONTRATO' },
  { id: 202, key: 'chepe-enero', label: 'CHEPE ENERO CONTRATO' },
]

const mkClient = (p) => xmlrpc.createSecureClient({ host: HOST, port: 443, path: p })
const call = (c, m, p) =>
  new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), 60000)
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

  const ids = PILOT.map((p) => p.id)
  const docs = await kw(object, uid, 'documents.document', 'read', [ids], {
    fields: ['id', 'name', 'mimetype', 'file_size', 'datas', 'create_date', 'write_date'],
  })

  const byId = new Map(docs.map((d) => [d.id, d]))
  const results = []

  for (const p of PILOT) {
    const doc = byId.get(p.id)
    if (!doc) {
      console.warn(`! ${p.key} (id=${p.id}) NOT FOUND in Odoo`)
      results.push({ ...p, status: 'not-found' })
      continue
    }
    if (!doc.datas) {
      console.warn(`! ${p.key} (id=${p.id}) has no datas`)
      results.push({ ...p, status: 'no-datas', name: doc.name, mimetype: doc.mimetype })
      continue
    }

    const buf = Buffer.from(doc.datas, 'base64')
    const docxPath = `scripts/audit-output/10-1-legal-text/${p.key}.docx`
    writeFileSync(docxPath, buf)

    let text = ''
    let warnings = []
    try {
      const r = await mammoth.extractRawText({ buffer: buf })
      text = r.value || ''
      warnings = (r.messages || []).map((m) => `${m.type}: ${m.message}`)
    } catch (e) {
      console.error(`! mammoth failed for ${p.key}:`, e.message)
      results.push({ ...p, status: 'mammoth-error', error: e.message, name: doc.name })
      continue
    }

    const txtPath = `scripts/audit-output/10-1-legal-text/${p.key}.txt`
    writeFileSync(txtPath, text)

    results.push({
      ...p,
      status: 'ok',
      name: doc.name,
      mimetype: doc.mimetype,
      fileSize: doc.file_size,
      createDate: doc.create_date,
      writeDate: doc.write_date,
      textLength: text.length,
      lineCount: text.split('\n').length,
      paragraphCount: text.split(/\n\s*\n/).filter((s) => s.trim()).length,
      warnings,
      txtPath,
      docxPath,
    })
    console.log(`✓ ${p.key} (id=${p.id}) ${doc.name} | ${text.length} chars | ${warnings.length} warnings`)
  }

  // Reporte markdown
  const lines = []
  lines.push('# Spike 10.1 — Extracción de texto legal de plantillas piloto')
  lines.push('')
  lines.push('**Generado:** ' + new Date().toISOString())
  lines.push('**Fuente:** Odoo Documents `documents.document.read` campo `datas` (base64 .docx) → `mammoth.extractRawText`')
  lines.push('')
  lines.push('## Resumen')
  lines.push('')
  lines.push('| Key | Destino | Odoo ID | Estado | Tamaño | Caracteres | Párrafos | Warnings |')
  lines.push('|---|---|---|---|---|---|---|---|')
  for (const r of results) {
    if (r.status === 'ok') {
      lines.push(
        `| \`${r.key}\` | ${r.label} | ${r.id} | ✓ ok | ${r.fileSize}b | ${r.textLength} | ${r.paragraphCount} | ${r.warnings.length} |`
      )
    } else {
      lines.push(`| \`${r.key}\` | ${r.label} | ${r.id} | ⚠ ${r.status} | — | — | — | — |`)
    }
  }
  lines.push('')
  lines.push('## Archivos generados')
  lines.push('')
  for (const r of results) {
    if (r.status === 'ok') {
      lines.push(`- **${r.key}** (\`${r.name}\`):`)
      lines.push(`  - Texto plano: \`${r.txtPath}\``)
      lines.push(`  - .docx original respaldado: \`${r.docxPath}\``)
      if (r.warnings.length) {
        lines.push(`  - Warnings mammoth: ${r.warnings.slice(0, 3).join('; ')}${r.warnings.length > 3 ? ` ...(+${r.warnings.length - 3})` : ''}`)
      }
    }
  }
  lines.push('')
  lines.push('## Validación con Paloma (siguiente paso)')
  lines.push('')
  lines.push('1. Alek revisa los `.txt` y confirma que el contenido legal coincide con lo que recuerda.')
  lines.push('2. Paloma valida visualmente el `.docx` respaldado (es el mismo que ella usa hoy en Odoo) — sin cambios.')
  lines.push('3. Alek convierte cada `.txt` en componente React-PDF en `src/lib/pdf/templates/contracts/{key}.tsx`:')
  lines.push('   - Texto legal hardcoded (validado).')
  lines.push('   - Variables dinámicas: `{nombre_cliente}`, `{viaje_destino}`, `{viaje_temporada}`, `{fecha_salida}`, `{fecha_regreso}`, `{monto_total_mxn}`, `{monto_total_letras}`, `{anticipo_mxn}`, `{saldo_mxn}`, `{agente_nombre}`, `{fecha_firma}`, `{contract_id}`.')
  lines.push('4. Paloma valida 1-2 PDFs renderizados antes de cerrar Task 7.')
  lines.push('')
  lines.push('## Restricción heredada Epic 9')
  lines.push('')
  lines.push('Los `.docx` originales en Odoo Documents **NO se tocan**. Paloma los sigue usando manual si quiere. Las plantillas React-PDF son source-of-truth de aquí en adelante para PDFs generados desde la plataforma.')
  lines.push('')

  const reportPath = '_bmad-output/implementation-artifacts/spikes/10-1-legal-text-extraction.md'
  writeFileSync(reportPath, lines.join('\n'))
  console.log(`\n✓ reporte: ${reportPath}`)

  // JSON crudo para debugging
  writeFileSync(
    'scripts/audit-output/10-1-legal-text-extraction.json',
    JSON.stringify({ generatedAt: new Date().toISOString(), uid, results }, null, 2)
  )
  console.log('✓ json: scripts/audit-output/10-1-legal-text-extraction.json')
}

main().catch((e) => {
  console.error('ERROR:', e)
  process.exit(1)
})
