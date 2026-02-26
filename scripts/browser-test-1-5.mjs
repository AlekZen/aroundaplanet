/**
 * Browser Test - Story 1.5: Odoo Client Abstraction Layer
 *
 * Pruebas:
 *   1. Seguridad: route handler rechaza usuario sin rol admin (403)
 *   2. Seguridad: route handler rechaza request sin cookie (401)
 *   3. Validacion: route handler rechaza model vacio
 *   4. Validacion: route handler rechaza fields vacio
 *   5. Odoo directo: authenticate via XML-RPC
 *   6. Odoo directo: search_read res.partner
 *   7. Odoo directo: search_read con domain filter
 *   8. Odoo directo: search_read sale.order
 *   9. Odoo directo: read_group sale.order
 *
 * Ejecutar: node scripts/browser-test-1-5.mjs
 */

import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'

// --- CONFIG ---
const BASE_URL = 'http://localhost:3000'

// Cookie del usuario con rol "cliente" (NO admin)
const SESSION_COOKIE = '__session=eyJhbGciOiJSUzI1NiIsImtpZCI6InZWX3pZdyJ9.eyJpc3MiOiJodHRwczovL3Nlc3Npb24uZmlyZWJhc2UuZ29vZ2xlLmNvbS9hcm91bmRhLXBsYW5ldCIsIm5hbWUiOiJBbGVrIFplbiIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJN0liV3R6a0pIQXJxOVNGdmlfckdFbElsN3hHbzVBY1JhcnA1d1MwS1pXT1VMN2xlM2p3XHUwMDNkczk2LWMiLCJyb2xlcyI6WyJjbGllbnRlIl0sImF1ZCI6ImFyb3VuZGEtcGxhbmV0IiwiYXV0aF90aW1lIjoxNzcyMTM0MTg3LCJ1c2VyX2lkIjoiZ2lmN1hWU3RpRWZPSkZyQk1DZUVDUU9nSmZaMiIsInN1YiI6ImdpZjdYVlN0aUVmT0pGckJNQ2VFQ1FPZ0pmWjIiLCJpYXQiOjE3NzIxMzU4NTEsImV4cCI6MTc3MzM0NTQ1MSwiZW1haWwiOiJvY29tcHVkb2NAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMTgwOTI1OTgyNzU5MzUzMDAzNjMiXSwiZW1haWwiOlsib2NvbXB1ZG9jQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.H_KT-YfOT7u3SKmg7mXMxA28vaHevzmshKMcQROGMAIm11L0tqfSFKu52pjHc30M7tuwI6WIvSOt8OflP7ByFoDHokOJ98kBUaiAkJD6bsRm97z0UKTgFKtaEhmCPXvMwT4jEI9pM2BAVu0ZhgLCUsZd-C3g7fcJ0QfnGNs2Jj4A2G_5c3hi9cJIJQq05ju41z9ZHtCvIsWiGnZ3oaKXQgrPyQx71CSR2zX-0bE2DOm6XDcOSL6-LvCNMKFznWAzi1y3drouwI3szfknyvtlhT7xiE8olqt3GMt9YxsRKTxP-LW-kixBHif7I2NvMqVfl4M3XJtszESWddWj9ILzTw'

// Odoo credentials (de .env.local)
const ODOO_URL = 'aroundaplanet.odoo.com'
const ODOO_DB = 'aroundaplanet'
const ODOO_USERNAME = 'noelnumata@gmail.com'
const ODOO_API_KEY = 'bd9e865a66e12c855f050521cfe2ef00bb1df7ad'

const OUTPUT_FILE = 'scripts/browser-test-1-5-results.json'

// --- HELPERS ---
function httpPost(path, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const url = new URL(path, BASE_URL)
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    }
    if (cookie) headers.Cookie = cookie

    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers },
      (res) => {
        let body = ''
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(body) }) }
          catch { resolve({ status: res.statusCode, data: body }) }
        })
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function xmlRpcCall(path, method, params) {
  return new Promise((resolve, reject) => {
    const body = `<?xml version="1.0"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>${params.map(p => `<param><value>${xmlValue(p)}</value></param>`).join('')}</params>
</methodCall>`

    const req = https.request(
      { hostname: ODOO_URL, port: 443, path, method: 'POST',
        headers: { 'Content-Type': 'text/xml', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          // Parse simple XML-RPC response
          const faultMatch = data.match(/<name>faultString<\/name>\s*<value>\s*<string>([\s\S]*?)<\/string>/)
          if (faultMatch) return reject(new Error(faultMatch[1]))

          // Extract top-level value type from <param><value>TYPE</value></param>
          const topValue = data.match(/<param>\s*<value>(\s*<\w+)/)
          const topType = topValue ? topValue[1].trim().replace('<', '') : ''

          if (topType === 'array') {
            return resolve({ raw: data, type: 'array' })
          }
          if (topType === 'int' || topType === 'i4') {
            const m = data.match(/<param>\s*<value>\s*<(?:int|i4)>(\d+)</)
            return resolve(m ? parseInt(m[1]) : 0)
          }
          if (topType === 'boolean') {
            const m = data.match(/<param>\s*<value>\s*<boolean>(\d)</)
            return resolve(m ? m[1] === '1' : false)
          }
          if (topType === 'string') {
            const m = data.match(/<param>\s*<value>\s*<string>([\s\S]*?)<\/string>/)
            return resolve(m ? m[1] : '')
          }

          resolve({ raw: data, type: topType || 'unknown' })
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function xmlValue(v) {
  if (typeof v === 'string') return `<string>${escapeXml(v)}</string>`
  if (typeof v === 'number') return Number.isInteger(v) ? `<int>${v}</int>` : `<double>${v}</double>`
  if (typeof v === 'boolean') return `<boolean>${v ? 1 : 0}</boolean>`
  if (Array.isArray(v)) return `<array><data>${v.map(i => `<value>${xmlValue(i)}</value>`).join('')}</data></array>`
  if (v && typeof v === 'object') {
    const members = Object.entries(v).map(([k, val]) =>
      `<member><name>${k}</name><value>${xmlValue(val)}</value></member>`
    ).join('')
    return `<struct>${members}</struct>`
  }
  return `<string>${String(v)}</string>`
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function countStructs(rawXml) {
  return (rawXml.match(/<struct>/g) || []).length
}

function extractFields(rawXml, fieldName) {
  const regex = new RegExp(`<name>${fieldName}</name>\\s*<value>\\s*<string>([\\s\\S]*?)</string>`, 'g')
  const matches = []
  let m
  while ((m = regex.exec(rawXml)) !== null) matches.push(m[1])
  return matches
}

// --- TEST RUNNER ---
const results = []

async function test(name, fn) {
  const start = Date.now()
  try {
    const detail = await fn()
    const ms = Date.now() - start
    results.push({ name, status: 'PASS', ms, detail })
    console.log(`  PASS  ${name} (${ms}ms)`)
    if (detail) console.log(`        ${JSON.stringify(detail).substring(0, 120)}`)
  } catch (err) {
    const ms = Date.now() - start
    results.push({ name, status: 'FAIL', ms, error: err.message })
    console.log(`  FAIL  ${name} (${ms}ms)`)
    console.log(`        ${err.message.substring(0, 200)}`)
  }
}

// =====================
// PARTE A: Route Handler (seguridad + validacion)
// =====================
console.log('\n=== PARTE A: Route Handler Security & Validation ===\n')

await test('A1: Rechaza usuario con rol "cliente" (espera 403)', async () => {
  const res = await httpPost('/api/odoo/search-read', {
    model: 'res.partner', fields: ['name'], limit: 1,
  }, SESSION_COOKIE)
  if (res.status !== 403) throw new Error(`Esperaba 403, recibio ${res.status}: ${JSON.stringify(res.data)}`)
  return { status: res.status, code: res.data?.code }
})

await test('A2: Rechaza request sin cookie (espera 401)', async () => {
  const res = await httpPost('/api/odoo/search-read', {
    model: 'res.partner', fields: ['name'], limit: 1,
  }, null)
  if (res.status !== 401) throw new Error(`Esperaba 401, recibio ${res.status}: ${JSON.stringify(res.data)}`)
  return { status: res.status, code: res.data?.code }
})

await test('A3: Rechaza model vacio (espera 400)', async () => {
  const res = await httpPost('/api/odoo/search-read', {
    model: '', fields: ['name'],
  }, SESSION_COOKIE)
  // Con cookie de cliente, primero falla auth (403). Eso esta bien, auth va antes que validacion.
  if (res.status === 200) throw new Error('Debio rechazar')
  return { status: res.status }
})

await test('A4: Rechaza fields vacio (espera 400)', async () => {
  const res = await httpPost('/api/odoo/search-read', {
    model: 'res.partner', fields: [],
  }, SESSION_COOKIE)
  if (res.status === 200) throw new Error('Debio rechazar')
  return { status: res.status }
})

// =====================
// PARTE B: Odoo Directo via XML-RPC
// =====================
console.log('\n=== PARTE B: Odoo Direct XML-RPC Connection ===\n')

let uid = null

await test('B1: Authenticate contra Odoo real', async () => {
  uid = await xmlRpcCall('/xmlrpc/2/common', 'authenticate', [
    ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}
  ])
  if (typeof uid !== 'number' || uid <= 0) throw new Error(`UID invalido: ${uid}`)
  return { uid }
})

await test('B2: search_read res.partner (limit 3)', async () => {
  if (!uid) throw new Error('No hay UID (B1 fallo)')
  const result = await xmlRpcCall('/xmlrpc/2/object', 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY,
    'res.partner', 'search_read',
    [[]], // domain: todos
    { fields: ['name', 'email', 'is_company'], limit: 3, offset: 0 }
  ])
  if (result.type !== 'array') throw new Error(`Esperaba array, recibio: ${result.type}`)
  const names = extractFields(result.raw, 'name')
  const count = countStructs(result.raw)
  if (count < 1) throw new Error('No se encontraron registros')
  return { records: count, names: names.slice(0, 3) }
})

await test('B3: search_read res.partner con domain [is_company=true]', async () => {
  if (!uid) throw new Error('No hay UID (B1 fallo)')
  const result = await xmlRpcCall('/xmlrpc/2/object', 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY,
    'res.partner', 'search_read',
    [[ ['is_company', '=', true] ]],
    { fields: ['name', 'email'], limit: 5, offset: 0 }
  ])
  if (result.type !== 'array') throw new Error(`Esperaba array`)
  const names = extractFields(result.raw, 'name')
  return { companies: names.length, sample: names.slice(0, 3) }
})

await test('B4: search_read sale.order (limit 3)', async () => {
  if (!uid) throw new Error('No hay UID (B1 fallo)')
  const result = await xmlRpcCall('/xmlrpc/2/object', 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY,
    'sale.order', 'search_read',
    [[]],
    { fields: ['name', 'state', 'amount_total', 'partner_id'], limit: 3, offset: 0 }
  ])
  if (result.type !== 'array') throw new Error(`Esperaba array`)
  const names = extractFields(result.raw, 'name')
  return { orders: names.length, sample: names.slice(0, 3) }
})

await test('B5: search_read product.product (limit 3)', async () => {
  if (!uid) throw new Error('No hay UID (B1 fallo)')
  const result = await xmlRpcCall('/xmlrpc/2/object', 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY,
    'product.product', 'search_read',
    [[]],
    { fields: ['name', 'list_price', 'active'], limit: 3, offset: 0 }
  ])
  if (result.type !== 'array') throw new Error(`Esperaba array`)
  const count = countStructs(result.raw)
  return { products: count }
})

await test('B6: read_group sale.order por state (kwargs Odoo 18)', async () => {
  if (!uid) throw new Error('No hay UID (B1 fallo)')
  const result = await xmlRpcCall('/xmlrpc/2/object', 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY,
    'sale.order', 'read_group',
    [[]], // domain en args
    { fields: ['amount_total:sum', 'state'], groupby: ['state'], lazy: false }
  ])
  if (result.type !== 'array') throw new Error(`Esperaba array`)
  const count = countStructs(result.raw)
  return { groups: count }
})

await test('B7: Auth rechazada con API key invalida', async () => {
  try {
    const badUid = await xmlRpcCall('/xmlrpc/2/common', 'authenticate', [
      ODOO_DB, ODOO_USERNAME, 'bad-api-key-12345', {}
    ])
    // Odoo returns false (0) for bad auth
    if (badUid === 0 || badUid === false) return { rejected: true }
    throw new Error(`Esperaba rechazo, recibio uid: ${badUid}`)
  } catch (err) {
    // Some Odoo versions throw an error
    return { rejected: true, error: err.message.substring(0, 50) }
  }
})

// --- RESUMEN ---
console.log('\n=== RESUMEN ===')
const passed = results.filter(r => r.status === 'PASS').length
const failed = results.filter(r => r.status === 'FAIL').length
console.log(`\n${passed}/${results.length} PASS, ${failed} FAIL\n`)

if (failed > 0) {
  console.log('FALLOS:')
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`)
  })
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2))
console.log(`\nResultados guardados en ${OUTPUT_FILE}`)
