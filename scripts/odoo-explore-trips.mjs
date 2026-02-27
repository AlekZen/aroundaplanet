/**
 * Story 2-1a Task 0: Query Exploratoria Odoo (v2 - fields_get first, then safe queries)
 * Ejecutar: node scripts/odoo-explore-trips.mjs
 */

import xmlrpc from 'xmlrpc'
import { readFileSync, writeFileSync } from 'fs'

// Load .env.local
const envContent = readFileSync('.env.local', 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim()
}

const ODOO_URL = env.ODOO_URL
const ODOO_DB = env.ODOO_DB
const ODOO_USER = env.ODOO_USERNAME
const ODOO_KEY = env.ODOO_API_KEY

const urlObj = new URL(ODOO_URL)
const commonClient = xmlrpc.createSecureClient({ host: urlObj.hostname, port: 443, path: '/xmlrpc/2/common' })
const objectClient = xmlrpc.createSecureClient({ host: urlObj.hostname, port: 443, path: '/xmlrpc/2/object' })

function call(client, method, params) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout 30s')), 30000)
    client.methodCall(method, params, (err, val) => {
      clearTimeout(timeout)
      if (err) reject(err)
      else resolve(val)
    })
  })
}

let uid
function executeKw(model, method, args, kwargs = {}) {
  return call(objectClient, 'execute_kw', [ODOO_DB, uid, ODOO_KEY, model, method, args, kwargs])
}

/** Only request fields that actually exist */
function safeFields(desiredFields, existingFieldNames) {
  return desiredFields.filter(f => existingFieldNames.has(f))
}

const results = {}

async function main() {
  console.log('=== ODOO EXPLORATORY QUERY v2 - Story 2-1a ===\n')

  // Auth
  uid = await call(commonClient, 'authenticate', [ODOO_DB, ODOO_USER, ODOO_KEY, {}])
  console.log(`UID: ${uid}\n`)

  // ===== PRODUCT.TEMPLATE =====
  console.log('========== PRODUCT.TEMPLATE ==========\n')

  const ptFields = await executeKw('product.template', 'fields_get', [], { attributes: ['string', 'type', 'relation'] })
  const ptFieldNames = new Set(Object.keys(ptFields))
  const ptFieldList = Object.entries(ptFields).map(([name, info]) => ({
    name, string: info.string, type: info.type, relation: info.relation || null,
  })).sort((a, b) => a.name.localeCompare(b.name))
  results.productTemplateFields = ptFieldList
  console.log(`Campos totales: ${ptFieldList.length}`)

  // Show interesting fields
  const ptInteresting = ptFieldList.filter(f =>
    ['name', 'list_price', 'type', 'categ_id', 'active', 'write_date', 'create_date',
     'image_1920', 'description_sale', 'website_published', 'rating_count', 'rating_avg',
     'default_code', 'description', 'website_description', 'public_categ_ids',
     'product_tag_ids', 'currency_id', 'sale_ok', 'purchase_ok',
    ].includes(f.name) || f.name.includes('event') || f.name.includes('seat')
  )
  console.log('\nCampos interesantes para trips:')
  for (const f of ptInteresting) {
    console.log(`  ${f.name} (${f.type}${f.relation ? ' -> ' + f.relation : ''}) = "${f.string}"`)
  }

  // Count
  const ptCount = await executeKw('product.template', 'search_count', [[]])
  results.productTemplateCount = ptCount
  console.log(`\nTotal registros: ${ptCount}`)

  // Sample with safe fields
  const ptSampleFields = safeFields([
    'name', 'list_price', 'type', 'categ_id', 'active', 'write_date', 'create_date',
    'description_sale', 'website_published', 'rating_count', 'rating_avg',
    'default_code', 'public_categ_ids', 'product_tag_ids', 'currency_id',
    'sale_ok', 'image_1920',
  ], ptFieldNames)
  console.log(`\nSample fields: ${ptSampleFields.join(', ')}`)

  const ptSample = await executeKw('product.template', 'search_read', [[]], {
    fields: ptSampleFields, limit: 5, order: 'id asc',
  })
  results.productTemplateSample = ptSample
  console.log('\nMuestra 5 primeros:')
  for (const p of ptSample) {
    const img = typeof p.image_1920 === 'string' ? `img:${p.image_1920.length}chars` : `img:${p.image_1920}`
    console.log(`  [${p.id}] ${p.name} - $${p.list_price} - type:${p.type} - categ:${JSON.stringify(p.categ_id)} - active:${p.active} - ${img}`)
  }

  // Categories
  const categories = await executeKw('product.category', 'search_read', [[]], {
    fields: ['name', 'parent_id', 'complete_name'], limit: 100,
  })
  results.productCategories = categories
  console.log('\nCategorias:')
  for (const c of categories) console.log(`  [${c.id}] ${c.complete_name || c.name}`)

  // Public categories
  try {
    const pubCategories = await executeKw('product.public.category', 'search_read', [[]], {
      fields: ['name', 'parent_id', 'complete_name'], limit: 100,
    })
    results.publicCategories = pubCategories
    console.log('\nCategorias publicas (website):')
    for (const c of pubCategories) console.log(`  [${c.id}] ${c.complete_name || c.name}`)
  } catch (e) { console.log(`\nproduct.public.category: ${e.message?.substring(0, 100)}`) }

  // Travel products by name
  const travelProducts = await executeKw('product.template', 'search_read', [
    ['|', '|', '|', '|', '|',
      ['name', 'ilike', 'vuelta'],
      ['name', 'ilike', 'viaje'],
      ['name', 'ilike', 'europa'],
      ['name', 'ilike', 'peru'],
      ['name', 'ilike', 'turquia'],
      ['name', 'ilike', 'japon'],
    ]
  ], {
    fields: safeFields(['name', 'list_price', 'type', 'categ_id', 'active', 'write_date',
      'description_sale', 'website_published', 'default_code', 'public_categ_ids'], ptFieldNames),
    limit: 50,
  })
  results.travelProducts = travelProducts
  console.log(`\nProductos "viaje" por nombre (${travelProducts.length}):`)
  for (const p of travelProducts) {
    console.log(`  [${p.id}] ${p.name} - $${p.list_price} - type:${p.type} - categ:${JSON.stringify(p.categ_id)} - web_pub:${p.website_published}`)
  }

  // Products in "Events" category (categ_id = 6)
  const eventProducts = await executeKw('product.template', 'search_read', [
    [['categ_id', '=', 6]]
  ], {
    fields: safeFields(['name', 'list_price', 'type', 'categ_id', 'active', 'write_date',
      'description_sale', 'default_code'], ptFieldNames),
    limit: 50,
  })
  results.eventCategoryProducts = eventProducts
  console.log(`\nProductos en categoria "Events" (${eventProducts.length}):`)
  for (const p of eventProducts) {
    console.log(`  [${p.id}] ${p.name} - $${p.list_price} - type:${p.type}`)
  }

  // Products with high price (likely trips, not hotels at $1)
  const highPriceProducts = await executeKw('product.template', 'search_read', [
    [['list_price', '>=', 5000], ['type', '=', 'service']]
  ], {
    fields: safeFields(['name', 'list_price', 'type', 'categ_id', 'active', 'write_date',
      'description_sale', 'website_published', 'default_code'], ptFieldNames),
    limit: 50, order: 'list_price desc',
  })
  results.highPriceProducts = highPriceProducts
  console.log(`\nProductos servicio con precio >= $5000 (${highPriceProducts.length}):`)
  for (const p of highPriceProducts) {
    console.log(`  [${p.id}] ${p.name} - $${p.list_price} - categ:${JSON.stringify(p.categ_id)} - web_pub:${p.website_published}`)
  }

  // ===== EVENT.EVENT =====
  console.log('\n========== EVENT.EVENT ==========\n')

  const evFields = await executeKw('event.event', 'fields_get', [], { attributes: ['string', 'type', 'relation'] })
  const evFieldNames = new Set(Object.keys(evFields))
  const evFieldList = Object.entries(evFields).map(([name, info]) => ({
    name, string: info.string, type: info.type, relation: info.relation || null,
  })).sort((a, b) => a.name.localeCompare(b.name))
  results.eventFields = evFieldList
  console.log(`Campos totales: ${evFieldList.length}`)

  // Show ALL event fields (not too many)
  console.log('\nTodos los campos de event.event:')
  for (const f of evFieldList) {
    console.log(`  ${f.name} (${f.type}${f.relation ? ' -> ' + f.relation : ''}) = "${f.string}"`)
  }

  // Count
  const evCount = await executeKw('event.event', 'search_count', [[]])
  results.eventCount = evCount
  console.log(`\nTotal registros: ${evCount}`)

  // Sample with safe fields
  const evSampleFields = safeFields([
    'name', 'date_begin', 'date_end', 'date_tz', 'seats_max', 'seats_available',
    'seats_used', 'seats_reserved', 'active', 'stage_id',
    'event_type_id', 'registration_ids', 'write_date', 'create_date',
    'website_published', 'company_id', 'organizer_id', 'event_ticket_ids',
    'note', 'description', 'tag_ids', 'kanban_state',
  ], evFieldNames)
  console.log(`\nSample fields: ${evSampleFields.join(', ')}`)

  const evSample = await executeKw('event.event', 'search_read', [[]], {
    fields: evSampleFields, limit: 10, order: 'date_begin desc',
  })
  results.eventSample = evSample
  console.log('\nMuestra 10 mas recientes:')
  for (const e of evSample) {
    console.log(`  [${e.id}] ${e.name}`)
    console.log(`    dates: ${e.date_begin} -> ${e.date_end}`)
    console.log(`    seats: max=${e.seats_max}, avail=${e.seats_available}, used=${e.seats_used}`)
    console.log(`    type: ${JSON.stringify(e.event_type_id)}, tickets: ${JSON.stringify(e.event_ticket_ids)}`)
    console.log(`    active: ${e.active}, web_pub: ${e.website_published}`)
  }

  // Relationship: check for product-related fields in events
  console.log('\n========== RELACION PRODUCT <-> EVENT ==========\n')

  const eventProductFields = evFieldList.filter(f =>
    f.name.includes('product') || (f.relation && f.relation.includes('product'))
  )
  console.log(`Campos event.event con "product": ${eventProductFields.length}`)
  for (const f of eventProductFields) console.log(`  ${f.name} (${f.type}) -> ${f.relation}`)

  const ptEventFields = ptFieldList.filter(f =>
    f.name.includes('event') || (f.relation && f.relation.includes('event'))
  )
  console.log(`\nCampos product.template con "event": ${ptEventFields.length}`)
  for (const f of ptEventFields) console.log(`  ${f.name} (${f.type}) -> ${f.relation}`)

  // event.event.ticket (the usual bridge between events and products)
  console.log('\n========== EVENT.EVENT.TICKET ==========\n')
  try {
    const ticketFields = await executeKw('event.event.ticket', 'fields_get', [], { attributes: ['string', 'type', 'relation'] })
    const ticketFieldNames = new Set(Object.keys(ticketFields))
    const ticketFieldList = Object.entries(ticketFields).map(([name, info]) => ({
      name, string: info.string, type: info.type, relation: info.relation || null,
    })).sort((a, b) => a.name.localeCompare(b.name))
    results.eventTicketFields = ticketFieldList
    console.log(`Campos totales: ${ticketFieldList.length}`)
    for (const f of ticketFieldList) {
      console.log(`  ${f.name} (${f.type}${f.relation ? ' -> ' + f.relation : ''}) = "${f.string}"`)
    }

    const ticketSampleFields = safeFields([
      'name', 'event_id', 'product_id', 'price', 'seats_max', 'seats_available',
      'description', 'sale_available', 'start_sale_datetime', 'end_sale_datetime',
    ], ticketFieldNames)

    const tickets = await executeKw('event.event.ticket', 'search_read', [[]], {
      fields: ticketSampleFields, limit: 15,
    })
    results.eventTicketSample = tickets
    console.log(`\nMuestra tickets (${tickets.length}):`)
    for (const t of tickets) {
      console.log(`  [${t.id}] ${t.name} - event:${JSON.stringify(t.event_id)} - product:${JSON.stringify(t.product_id)} - $${t.price}`)
    }
  } catch (e) { console.log(`event.event.ticket error: ${e.message?.substring(0, 200)}`) }

  // event.type
  console.log('\n========== EVENT.TYPE ==========\n')
  try {
    const etFields = await executeKw('event.type', 'fields_get', [], { attributes: ['string', 'type', 'relation'] })
    const etFieldNames = new Set(Object.keys(etFields))

    const eventTypes = await executeKw('event.type', 'search_read', [[]], {
      fields: safeFields(['name', 'use_ticketing', 'has_seats_limitation', 'seats_max',
        'event_type_ticket_ids', 'tag_ids', 'note'], etFieldNames),
      limit: 20,
    })
    results.eventTypes = eventTypes
    console.log(`Event types (${eventTypes.length}):`)
    for (const t of eventTypes) {
      console.log(`  [${t.id}] ${t.name} - ticketing:${t.use_ticketing} - seats_limit:${t.has_seats_limitation}`)
    }
  } catch (e) { console.log(`event.type error: ${e.message?.substring(0, 200)}`) }

  // Future events (2025+)
  console.log('\n========== EVENTOS FUTUROS (2025+) ==========\n')
  const futureEvSampleFields = safeFields([
    'name', 'date_begin', 'date_end', 'seats_max', 'seats_available', 'seats_used',
    'active', 'stage_id', 'event_type_id', 'write_date', 'event_ticket_ids',
  ], evFieldNames)

  const futureEvents = await executeKw('event.event', 'search_read', [
    [['date_begin', '>=', '2025-01-01 00:00:00']]
  ], {
    fields: futureEvSampleFields, limit: 50, order: 'date_begin asc',
  })
  results.futureEvents = futureEvents
  console.log(`${futureEvents.length} eventos futuros:`)
  for (const e of futureEvents) {
    console.log(`  [${e.id}] ${e.name} - ${e.date_begin} -> ${e.date_end} - seats:${e.seats_max}max/${e.seats_available}avail/${e.seats_used}used - active:${e.active}`)
  }

  // Save
  // Strip image_1920 binary data from results (too large)
  if (results.productTemplateSample) {
    for (const p of results.productTemplateSample) {
      if (typeof p.image_1920 === 'string' && p.image_1920.length > 100) {
        p.image_1920 = `[BASE64 ${p.image_1920.length} chars]`
      }
    }
  }

  writeFileSync('scripts/odoo-explore-results.json', JSON.stringify(results, null, 2))
  console.log('\n=== Resultados guardados en scripts/odoo-explore-results.json ===')
}

main().catch(err => {
  // Save partial results even on error
  writeFileSync('scripts/odoo-explore-results.json', JSON.stringify(results, null, 2))
  console.error('\nERROR (partial results saved):', err.message?.substring(0, 200))
  process.exit(1)
})
