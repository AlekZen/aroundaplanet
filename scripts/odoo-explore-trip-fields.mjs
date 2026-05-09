/**
 * Script de exploracion: campos de product.template en Odoo
 * Obtiene fields_get completo + un registro de muestra de un trip
 *
 * Uso: node scripts/odoo-explore-trip-fields.mjs
 */

import xmlrpc from 'xmlrpc'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Credenciales Odoo (confirmadas 24-feb-2026)
const ODOO_URL = 'https://aroundaplanet.odoo.com'
const ODOO_DB = 'aroundaplanet'
const ODOO_USERNAME = 'noelnumata@gmail.com'
const ODOO_API_KEY = 'bd9e865a66e12c855f050521cfe2ef00bb1df7ad'

// Campos ya sincronizados en Story 2-1a (para comparar)
const ALREADY_SYNCED = new Set([
  'id', 'name', 'list_price', 'type', 'categ_id', 'active', 'write_date',
  'create_date', 'description_sale', 'website_published', 'image_1920',
  'sale_ok', 'default_code', 'currency_id', 'rating_count', 'rating_avg',
])

function createSecureClient(path) {
  const urlObj = new URL(ODOO_URL)
  return xmlrpc.createSecureClient({
    host: urlObj.hostname,
    port: 443,
    path,
  })
}

function xmlRpcCall(client, method, params) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout: Odoo no respondio en 30s'))
    }, 30000)

    client.methodCall(method, params, (error, value) => {
      clearTimeout(timeout)
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
        return
      }
      resolve(value)
    })
  })
}

async function main() {
  console.log('=== Exploracion de campos product.template en Odoo ===\n')

  const commonClient = createSecureClient('/xmlrpc/2/common')
  const objectClient = createSecureClient('/xmlrpc/2/object')

  // 1. Autenticar
  console.log('1. Autenticando...')
  const uid = await xmlRpcCall(commonClient, 'authenticate', [
    ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}
  ])
  if (!uid || typeof uid !== 'number') {
    throw new Error('Autenticacion fallida - verificar credenciales')
  }
  console.log(`   OK - UID: ${uid}\n`)

  // Helper para execute_kw
  function executeKw(model, method, args, kwargs = {}) {
    return xmlRpcCall(objectClient, 'execute_kw', [
      ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs
    ])
  }

  // 2. fields_get de product.template (todos los campos)
  console.log('2. Obteniendo fields_get de product.template...')
  const rawFieldsGet = await executeKw(
    'product.template',
    'fields_get',
    [],
    { attributes: ['string', 'type', 'help', 'required', 'readonly', 'store', 'compute', 'related'] }
  )

  // Formatear fields_get como { fieldName: { type, string, help, required, readonly, store, compute, related } }
  const fieldsGet = {}
  for (const [fieldName, meta] of Object.entries(rawFieldsGet)) {
    fieldsGet[fieldName] = {
      type: meta.type || '',
      string: meta.string || '',
      help: meta.help || '',
      required: meta.required || false,
      readonly: meta.readonly || false,
      store: meta.store !== undefined ? meta.store : true,
      compute: meta.compute || null,
      related: meta.related || null,
    }
  }

  const totalFields = Object.keys(fieldsGet).length
  console.log(`   OK - ${totalFields} campos encontrados\n`)

  // 3. Buscar el primer trip (name ilike 2026 AND list_price >= 5000 AND type = service)
  console.log('3. Buscando trips con filtro 2026 + list_price >= 5000 + type = service...')
  const tripIds = await executeKw(
    'product.template',
    'search',
    [[
      ['name', 'ilike', '2026'],
      ['list_price', '>=', 5000],
      ['type', '=', 'service'],
    ]],
    { limit: 1 }
  )

  if (!tripIds || tripIds.length === 0) {
    throw new Error('No se encontraron trips con el filtro especificado')
  }
  console.log(`   OK - IDs encontrados: ${JSON.stringify(tripIds)}\n`)

  // 4. Leer el primer trip con TODOS los campos
  console.log('4. Leyendo registro completo del primer trip...')
  const allFieldNames = Object.keys(rawFieldsGet)
  const tripRecords = await executeKw(
    'product.template',
    'read',
    [tripIds],
    { fields: allFieldNames }
  )
  const sampleRecord = tripRecords[0]
  console.log(`   OK - Registro cargado: "${sampleRecord.name}"\n`)

  // 5. Analizar campos interesantes no sincronizados
  console.log('5. Analizando campos no sincronizados...')

  const notSynced = []
  const categoriesByType = {}

  for (const [fieldName, meta] of Object.entries(fieldsGet)) {
    if (ALREADY_SYNCED.has(fieldName)) continue

    const value = sampleRecord[fieldName]
    const hasValue = value !== false && value !== null && value !== undefined && value !== '' &&
      !(Array.isArray(value) && value.length === 0)

    notSynced.push({
      fieldName,
      type: meta.type,
      label: meta.string,
      help: meta.help ? meta.help.substring(0, 200) : '',
      hasValueInSample: hasValue,
      sampleValue: formatSampleValue(value),
      isStored: meta.store,
      isComputed: !!meta.compute,
      isRelated: !!meta.related,
    })

    // Agrupar por tipo
    if (!categoriesByType[meta.type]) categoriesByType[meta.type] = []
    categoriesByType[meta.type].push(fieldName)
  }

  // Ordenar: primero los que tienen valor en la muestra
  notSynced.sort((a, b) => {
    if (a.hasValueInSample && !b.hasValueInSample) return -1
    if (!a.hasValueInSample && b.hasValueInSample) return 1
    return a.fieldName.localeCompare(b.fieldName)
  })

  console.log(`   OK - ${notSynced.length} campos no sincronizados analizados\n`)

  // 6. Identificar campos mas interesantes (con valor en muestra, no computados de calculo interno)
  const interesting = notSynced.filter(f =>
    f.hasValueInSample &&
    !['many2many', 'one2many'].includes(f.type) // excluir relaciones complejas del top
  ).slice(0, 30)

  // 7. Construir output final
  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      odooUrl: ODOO_URL,
      model: 'product.template',
      totalFields,
      alreadySyncedCount: ALREADY_SYNCED.size,
      notSyncedCount: notSynced.length,
      fieldsWithValueInSample: notSynced.filter(f => f.hasValueInSample).length,
      sampleTripId: tripIds[0],
      sampleTripName: sampleRecord.name,
    },
    summary: {
      fieldsByType: categoriesByType,
      interestingNotSynced: interesting,
    },
    allNotSyncedFields: notSynced,
    fieldsGet,
    sampleRecord,
  }

  // 8. Guardar a JSON
  const outputPath = join(__dirname, 'odoo-explore-trip-fields.json')
  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`Resultado guardado en: scripts/odoo-explore-trip-fields.json\n`)

  // 9. Imprimir resumen en consola
  console.log('=== RESUMEN ===\n')
  console.log(`Total de campos en product.template: ${totalFields}`)
  console.log(`Ya sincronizados: ${ALREADY_SYNCED.size}`)
  console.log(`No sincronizados: ${notSynced.length}`)
  console.log(`Con valor en la muestra: ${notSynced.filter(f => f.hasValueInSample).length}\n`)

  console.log('--- Campos por tipo ---')
  for (const [type, fields] of Object.entries(categoriesByType).sort()) {
    console.log(`  ${type}: ${fields.length} campos`)
  }

  console.log('\n--- Campos interesantes con valor (no sincronizados) ---')
  for (const f of interesting) {
    console.log(`  ${f.fieldName} [${f.type}]: "${f.label}" = ${f.sampleValue}`)
  }

  console.log('\n--- Lo que revela la muestra del trip ---')
  console.log(`  Nombre: ${sampleRecord.name}`)
  console.log(`  Precio: ${sampleRecord.list_price} ${sampleRecord.currency_id?.[1] || ''}`)
  console.log(`  Tipo: ${sampleRecord.type}`)
  console.log(`  Activo: ${sampleRecord.active}`)
  console.log(`  Website publicado: ${sampleRecord.website_published}`)
  console.log(`  Sale OK: ${sampleRecord.sale_ok}`)
  if (sampleRecord.description_sale) {
    const desc = String(sampleRecord.description_sale)
    console.log(`  Descripcion venta (primeros 200 chars): ${desc.substring(0, 200)}`)
  }

  console.log('\n=== FIN ===')
}

function formatSampleValue(value) {
  if (value === false || value === null || value === undefined) return 'false/null'
  if (typeof value === 'string') return `"${value.substring(0, 80)}${value.length > 80 ? '...' : ''}"`
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    if (value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'string') {
      return `[${value[0]}, "${value[1]}"]` // many2one
    }
    return `[${value.length} items]`
  }
  if (typeof value === 'object') return JSON.stringify(value).substring(0, 80)
  return String(value).substring(0, 80)
}

main().catch(err => {
  console.error('ERROR:', err.message || err)
  process.exit(1)
})
