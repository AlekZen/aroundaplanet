/**
 * odoo-explore-documents.mjs
 * Explora el modelo product.document en Odoo 18 via XML-RPC.
 *
 * Pasos:
 * 1. fields_get en product.document para conocer todos los campos
 * 2. Buscar product.template con product_document_count > 0
 * 3. Buscar product.document linked a esos productos
 * 4. Imprimir y guardar resultados a odoo-explore-documents.json
 */

import xmlrpc from 'xmlrpc'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

// --- Credenciales (aroundaplanet) ---
const ODOO_URL = 'https://aroundaplanet.odoo.com'
const ODOO_DB = 'aroundaplanet'
const ODOO_USERNAME = 'noelnumata@gmail.com'
const ODOO_API_KEY = 'bd9e865a66e12c855f050521cfe2ef00bb1df7ad'

// --- Helpers XML-RPC ---
function createClient(urlPath) {
  return xmlrpc.createSecureClient({
    host: 'aroundaplanet.odoo.com',
    port: 443,
    path: urlPath,
  })
}

function callMethod(client, method, params) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout 30s')), 30000)
    client.methodCall(method, params, (err, value) => {
      clearTimeout(timeout)
      if (err) reject(err)
      else resolve(value)
    })
  })
}

function executeKw(objectClient, uid, model, method, args, kwargs = {}) {
  return callMethod(objectClient, 'execute_kw', [
    ODOO_DB,
    uid,
    ODOO_API_KEY,
    model,
    method,
    args,
    kwargs,
  ])
}

// Excluir campos binarios que pueden causar errores de encoding
const BINARY_FIELDS = ['raw', 'datas', 'db_datas']
const COMPUTED_NON_STORED = ['product_document_count']

// --- Main ---
async function main() {
  const results = {
    timestamp: new Date().toISOString(),
    steps: {},
  }

  const commonClient = createClient('/xmlrpc/2/common')
  const objectClient = createClient('/xmlrpc/2/object')

  // 1. Autenticar
  console.log('\n[1] Autenticando con Odoo...')
  const uid = await callMethod(commonClient, 'authenticate', [
    ODOO_DB,
    ODOO_USERNAME,
    ODOO_API_KEY,
    {},
  ])

  if (!uid || typeof uid !== 'number') {
    throw new Error('Autenticacion fallida — uid invalido: ' + uid)
  }
  console.log(`    UID obtenido: ${uid}`)
  results.steps.auth = { uid, success: true }

  // 2. fields_get en product.document
  console.log('\n[2] Obteniendo fields_get de product.document...')
  const fieldsGet = await executeKw(objectClient, uid, 'product.document', 'fields_get', [], {
    attributes: ['string', 'type', 'required', 'readonly', 'help', 'relation', 'store'],
  })
  const fieldNames = Object.keys(fieldsGet)
  console.log(`    Campos encontrados: ${fieldNames.length}`)
  console.log('    Lista de campos:')
  for (const [fname, fmeta] of Object.entries(fieldsGet)) {
    const relStr = fmeta.relation ? ` -> ${fmeta.relation}` : ''
    const storeStr = fmeta.store === false ? ' [computed]' : ''
    console.log(`      - ${fname} (${fmeta.type})${relStr}${storeStr}: ${fmeta.string}`)
  }
  results.steps.fieldsGet = { count: fieldNames.length, fields: fieldsGet }

  // Separar campos seguros (no binarios, stored)
  const safeFields = fieldNames.filter(f =>
    !BINARY_FIELDS.includes(f) &&
    fieldsGet[f].type !== 'binary'
  )

  // 3. Contar registros totales en product.document
  console.log('\n[3] Contando registros en product.document...')
  const totalCount = await executeKw(
    objectClient, uid, 'product.document', 'search_count', [[]]
  )
  console.log(`    Total registros product.document: ${totalCount}`)
  results.steps.productDocumentCount = { total: totalCount }

  // 4. Leer una muestra de product.document (sin campos binarios)
  console.log('\n[4] Leyendo muestra de product.document (sin binarios)...')
  try {
    const sampleDocs = await executeKw(
      objectClient,
      uid,
      'product.document',
      'search_read',
      [[]],
      {
        fields: safeFields,
        limit: 30,
        order: 'id asc',
      }
    )
    console.log(`    Muestra: ${sampleDocs.length} documentos`)
    for (const doc of sampleDocs.slice(0, 15)) {
      const resInfo = doc.res_model ? ` [${doc.res_model} id=${doc.res_id}]` : ''
      console.log(`      - [${doc.id}] ${doc.name || doc.display_name || 'sin nombre'}${resInfo}`)
      if (doc.mimetype) console.log(`          mimetype: ${doc.mimetype}`)
      if (doc.type) console.log(`          type: ${doc.type}`)
      if (doc.file_size) console.log(`          file_size: ${doc.file_size} bytes`)
      if (doc.url) console.log(`          url: ${doc.url}`)
      if (doc.local_url) console.log(`          local_url: ${doc.local_url}`)
      if (doc.shown_on_product_page !== undefined) console.log(`          shown_on_product_page: ${doc.shown_on_product_page}`)
      if (doc.attached_on_sale) console.log(`          attached_on_sale: ${doc.attached_on_sale}`)
      if (doc.ir_attachment_id) console.log(`          ir_attachment_id: ${JSON.stringify(doc.ir_attachment_id)}`)
    }
    results.steps.sampleDocuments = { count: sampleDocs.length, documents: sampleDocs }
  } catch (err) {
    console.log(`    ERROR leyendo muestra: ${err.message}`)
    results.steps.sampleDocuments = { error: err.message }

    // Si falla con safeFields, intentar con campos minimos
    console.log('    Intentando con campos minimos...')
    try {
      const minimalDocs = await executeKw(
        objectClient,
        uid,
        'product.document',
        'search_read',
        [[]],
        {
          fields: ['id', 'name', 'type', 'mimetype', 'file_size', 'url', 'res_model', 'res_id', 'res_name'],
          limit: 30,
        }
      )
      console.log(`    Muestra minimal: ${minimalDocs.length} documentos`)
      results.steps.sampleDocumentsMinimal = { count: minimalDocs.length, documents: minimalDocs }
    } catch (e2) {
      console.log(`    ERROR minimal: ${e2.message}`)
      results.steps.sampleDocumentsMinimal = { error: e2.message }
    }
  }

  // 5. Buscar product.document vinculados a product.template
  console.log('\n[5] Buscando product.document ligados a product.template...')
  try {
    const ptDocs = await executeKw(
      objectClient,
      uid,
      'product.document',
      'search_read',
      [[['res_model', '=', 'product.template']]],
      {
        fields: ['id', 'name', 'type', 'mimetype', 'file_size', 'url', 'local_url',
                 'res_id', 'res_name', 'shown_on_product_page', 'attached_on_sale',
                 'ir_attachment_id', 'public', 'access_token'],
        limit: 50,
        order: 'res_id asc, id asc',
      }
    )
    console.log(`    product.document con res_model=product.template: ${ptDocs.length}`)
    for (const doc of ptDocs.slice(0, 20)) {
      console.log(`      - [${doc.id}] ${doc.name}`)
      console.log(`          res_id: ${doc.res_id} (${doc.res_name || 'sin nombre'})`)
      console.log(`          type: ${doc.type}, mimetype: ${doc.mimetype}`)
      if (doc.file_size) console.log(`          file_size: ${doc.file_size} bytes`)
      if (doc.url) console.log(`          url: ${doc.url}`)
      if (doc.local_url) console.log(`          local_url: ${doc.local_url}`)
      if (doc.ir_attachment_id) console.log(`          ir_attachment_id: ${JSON.stringify(doc.ir_attachment_id)}`)
    }
    results.steps.productTemplateDocs = { count: ptDocs.length, documents: ptDocs }
  } catch (err) {
    console.log(`    ERROR: ${err.message}`)
    results.steps.productTemplateDocs = { error: err.message }
  }

  // 6. Buscar product.document ligados a trips especificos (los de la sync 2-1a)
  console.log('\n[6] Buscando trips sincronizados en Firestore...')

  // Primero buscar trips validos en Odoo
  const trips = await executeKw(
    objectClient,
    uid,
    'product.template',
    'search_read',
    [[
      ['name', 'ilike', '2026'],
      ['list_price', '>=', 5000],
      ['type', '=', 'service'],
    ]],
    {
      fields: ['id', 'name', 'list_price'],
      limit: 20,
      order: 'name asc',
    }
  )
  console.log(`    Trips encontrados: ${trips.length}`)
  const tripIds = trips.map(t => t.id)
  results.steps.trips2026 = { count: trips.length, trips }

  // Buscar TURQUIA especificamente (mencionado en el prompt como ejemplo con 8 docs)
  const turquiaTrips = trips.filter(t => t.name.toLowerCase().includes('turquia') ||
                                         t.name.toLowerCase().includes('turq'))
  if (turquiaTrips.length > 0) {
    console.log(`\n    TURQUIA trips: ${turquiaTrips.length}`)
    for (const t of turquiaTrips) {
      console.log(`      - [${t.id}] ${t.name}`)
    }
  }

  // 7. Buscar product.document de los trips
  console.log('\n[7] Buscando product.document de trips 2026...')
  if (tripIds.length > 0) {
    try {
      const tripDocs = await executeKw(
        objectClient,
        uid,
        'product.document',
        'search_read',
        [[
          ['res_model', '=', 'product.template'],
          ['res_id', 'in', tripIds],
        ]],
        {
          fields: ['id', 'name', 'type', 'mimetype', 'file_size', 'url', 'local_url',
                   'res_id', 'res_name', 'shown_on_product_page', 'attached_on_sale',
                   'ir_attachment_id', 'public', 'access_token', 'active'],
          limit: 100,
          order: 'res_id asc, id asc',
        }
      )
      console.log(`    Documentos de trips 2026: ${tripDocs.length}`)

      // Agrupar por trip
      const docsByTrip = {}
      for (const doc of tripDocs) {
        const resId = String(doc.res_id)
        if (!docsByTrip[resId]) docsByTrip[resId] = []
        docsByTrip[resId].push(doc)
      }

      for (const [resId, docs] of Object.entries(docsByTrip)) {
        const trip = trips.find(t => String(t.id) === resId)
        console.log(`\n    Trip [${resId}] ${trip?.name || 'desconocido'}: ${docs.length} documentos`)
        for (const doc of docs) {
          console.log(`      - [${doc.id}] ${doc.name}`)
          console.log(`          type: ${doc.type}, mimetype: ${doc.mimetype}`)
          if (doc.file_size) console.log(`          file_size: ${doc.file_size} bytes (${Math.round(doc.file_size/1024)} KB)`)
          if (doc.url) console.log(`          url: ${doc.url}`)
          if (doc.local_url) console.log(`          local_url: ${doc.local_url}`)
          console.log(`          shown_on_product_page: ${doc.shown_on_product_page}`)
          console.log(`          attached_on_sale: ${doc.attached_on_sale}`)
          if (doc.ir_attachment_id) console.log(`          ir_attachment_id: ${JSON.stringify(doc.ir_attachment_id)}`)
          if (doc.access_token) console.log(`          access_token: ${doc.access_token}`)
        }
      }

      results.steps.tripDocuments = {
        count: tripDocs.length,
        byTrip: docsByTrip,
        documents: tripDocs,
      }
    } catch (err) {
      console.log(`    ERROR: ${err.message}`)
      results.steps.tripDocuments = { error: err.message }
    }
  }

  // 8. Explorar ir.attachment de trips para comparar
  console.log('\n[8] Buscando ir.attachment de trips 2026 (para comparar)...')
  if (tripIds.length > 0) {
    try {
      const attachments = await executeKw(
        objectClient,
        uid,
        'ir.attachment',
        'search_read',
        [[
          ['res_model', '=', 'product.template'],
          ['res_id', 'in', tripIds],
        ]],
        {
          fields: [
            'id', 'name', 'mimetype', 'type', 'url', 'file_size',
            'res_id', 'res_name', 'public', 'access_token', 'local_url',
            'create_date', 'write_date',
          ],
          limit: 100,
          order: 'res_id asc, id asc',
        }
      )
      console.log(`    ir.attachment de trips 2026: ${attachments.length}`)
      for (const att of attachments.slice(0, 20)) {
        console.log(`      - [${att.id}] ${att.name} (res_id: ${att.res_id})`)
        console.log(`          type: ${att.type}, mimetype: ${att.mimetype}`)
        if (att.file_size) console.log(`          file_size: ${att.file_size} bytes`)
        if (att.url) console.log(`          url: ${att.url}`)
        if (att.local_url) console.log(`          local_url: ${att.local_url}`)
      }
      results.steps.irAttachmentsTrips = { count: attachments.length, attachments }
    } catch (err) {
      console.log(`    ERROR: ${err.message}`)
      results.steps.irAttachmentsTrips = { error: err.message }
    }
  }

  // 9. Explorar documents.document (modulo documents)
  console.log('\n[9] Explorando documents.document (modulo documents de Odoo)...')
  try {
    const docFields = await executeKw(objectClient, uid, 'documents.document', 'fields_get', [], {
      attributes: ['string', 'type', 'relation', 'store'],
    })
    const docFieldNames = Object.keys(docFields)
    console.log(`    documents.document existe — ${docFieldNames.length} campos`)

    // Seleccionar campos seguros
    const safeDocFields = docFieldNames.filter(f => {
      const meta = docFields[f]
      return meta.type !== 'binary' && meta.store !== false
    }).slice(0, 30) // limitar a 30 campos para evitar errores

    console.log(`    Campos seguros para query: ${safeDocFields.join(', ')}`)

    // Probar con campos minimos primeros
    const minFields = ['id', 'name', 'type', 'mimetype', 'file_size', 'url',
                       'partner_id', 'create_date', 'folder_id', 'res_model',
                       'res_id', 'res_name', 'access_token', 'description']

    const docsRecords = await executeKw(
      objectClient,
      uid,
      'documents.document',
      'search_read',
      [[]],
      {
        fields: minFields,
        limit: 30,
        order: 'create_date desc',
      }
    )

    console.log(`    Registros: ${docsRecords.length}`)
    for (const doc of docsRecords.slice(0, 10)) {
      console.log(`      - [${doc.id}] ${doc.name || 'sin nombre'}`)
      console.log(`          type: ${doc.type}, mimetype: ${doc.mimetype}`)
      if (doc.file_size) console.log(`          file_size: ${doc.file_size}`)
      if (doc.url) console.log(`          url: ${doc.url}`)
      if (doc.folder_id) console.log(`          folder: ${JSON.stringify(doc.folder_id)}`)
      if (doc.res_model) console.log(`          res_model: ${doc.res_model}, res_id: ${doc.res_id}`)
    }

    results.steps.documentsModule = {
      fieldCount: docFieldNames.length,
      fieldsList: docFields,
      recordCount: docsRecords.length,
      records: docsRecords,
    }
  } catch (err) {
    console.log(`    ERROR: ${err.message}`)
    results.steps.documentsModule = { error: err.message }
  }

  // 10. Probar construir URL de descarga para un documento
  console.log('\n[10] Construyendo URLs de acceso para documentos...')
  const sampleDoc = results.steps.sampleDocuments?.documents?.[0] ||
                    results.steps.productTemplateDocs?.documents?.[0]

  if (sampleDoc) {
    const irAttachId = sampleDoc.ir_attachment_id
    console.log(`    Documento ejemplo: [${sampleDoc.id}] ${sampleDoc.name}`)
    console.log(`    ir_attachment_id: ${JSON.stringify(irAttachId)}`)

    // URL patterns en Odoo 18
    const attachId = Array.isArray(irAttachId) ? irAttachId[0] : null
    if (attachId) {
      const urls = {
        webImageUrl: `${ODOO_URL}/web/image/ir.attachment/${attachId}/raw`,
        webContentUrl: `${ODOO_URL}/web/content/${attachId}?download=true`,
        webContentWithName: `${ODOO_URL}/web/content/${attachId}/${encodeURIComponent(sampleDoc.name || 'file')}`,
      }
      console.log('    URLs posibles:')
      for (const [key, url] of Object.entries(urls)) {
        console.log(`      ${key}: ${url}`)
      }
      results.steps.urlPatterns = { sampleDocId: sampleDoc.id, attachId, urls }
    }
  }

  // --- Guardar resultados ---
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const outputPath = path.join(__dirname, 'odoo-explore-documents.json')
  writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8')
  console.log(`\n[OK] Resultados guardados en: ${outputPath}`)

  return results
}

main().catch(err => {
  console.error('\n[FATAL]', err.message)
  process.exit(1)
})
