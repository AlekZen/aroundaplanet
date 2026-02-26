/**
 * Script de prueba manual para Story 1.5 - Odoo Client Abstraction Layer
 *
 * Ejecutar:
 *   node scripts/test-odoo-client.mjs
 *
 * Requiere:
 *   - Servidor Next.js corriendo en localhost:3000 (pnpm dev)
 *   - Usuario admin autenticado (cookie de sesion valida)
 *
 * Instrucciones:
 *   1. pnpm dev
 *   2. Login como admin en el navegador
 *   3. Copiar cookie __session del navegador (DevTools > Application > Cookies)
 *   4. Pegar en SESSION_COOKIE abajo
 *   5. node scripts/test-odoo-client.mjs
 */

import http from 'node:http'
import fs from 'node:fs'

// --- CONFIGURACION ---
const BASE_URL = 'http://localhost:3000'
const SESSION_COOKIE = '__session=PEGAR_COOKIE_AQUI'
const OUTPUT_FILE = 'scripts/test-odoo-results.json'

// --- HELPERS ---
function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const url = new URL(path, BASE_URL)

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Cookie: SESSION_COOKIE,
        },
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) })
          } catch {
            resolve({ status: res.statusCode, data: body })
          }
        })
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

// --- TESTS ---
const results = []

async function test(name, fn) {
  const start = Date.now()
  try {
    const result = await fn()
    const ms = Date.now() - start
    results.push({ name, status: 'PASS', ms, ...result })
    console.log(`  PASS  ${name} (${ms}ms)`)
  } catch (err) {
    const ms = Date.now() - start
    results.push({ name, status: 'FAIL', ms, error: err.message })
    console.log(`  FAIL  ${name} (${ms}ms) - ${err.message}`)
  }
}

console.log('\n=== Story 1.5 - Odoo Client Manual Tests ===\n')

// Test 1: searchRead basico - res.partner
await test('searchRead res.partner (limit 3)', async () => {
  const res = await post('/api/odoo/search-read', {
    model: 'res.partner',
    fields: ['name', 'email', 'is_company'],
    limit: 3,
  })
  if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`)
  if (!Array.isArray(res.data)) throw new Error('Response no es array')
  return { records: res.data.length, sample: res.data[0] }
})

// Test 2: searchRead con domain filter
await test('searchRead res.partner con domain [is_company=true]', async () => {
  const res = await post('/api/odoo/search-read', {
    model: 'res.partner',
    domain: [['is_company', '=', true]],
    fields: ['name', 'email'],
    limit: 5,
  })
  if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`)
  return { records: res.data.length }
})

// Test 3: searchRead sale.order
await test('searchRead sale.order (limit 3)', async () => {
  const res = await post('/api/odoo/search-read', {
    model: 'sale.order',
    fields: ['name', 'state', 'amount_total', 'partner_id'],
    limit: 3,
  })
  if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`)
  return { records: res.data.length, sample: res.data[0] }
})

// Test 4: searchRead product.product
await test('searchRead product.product (limit 3)', async () => {
  const res = await post('/api/odoo/search-read', {
    model: 'product.product',
    fields: ['name', 'list_price', 'active'],
    limit: 3,
  })
  if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`)
  return { records: res.data.length }
})

// Test 5: Validacion - model vacio
await test('Rechazo: model vacio', async () => {
  const res = await post('/api/odoo/search-read', {
    model: '',
    fields: ['name'],
  })
  if (res.status === 200) throw new Error('Debio rechazar model vacio')
  return { status: res.status }
})

// Test 6: Validacion - fields vacio
await test('Rechazo: fields vacio', async () => {
  const res = await post('/api/odoo/search-read', {
    model: 'res.partner',
    fields: [],
  })
  if (res.status === 200) throw new Error('Debio rechazar fields vacio')
  return { status: res.status }
})

// Test 7: Sin auth (cookie invalida)
await test('Rechazo: sin autenticacion', async () => {
  const data = JSON.stringify({ model: 'res.partner', fields: ['name'] })
  const result = await new Promise((resolve, reject) => {
    const url = new URL('/api/odoo/search-read', BASE_URL)
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          // Sin cookie
        },
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) })
          } catch {
            resolve({ status: res.statusCode, data: body })
          }
        })
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
  if (result.status === 200) throw new Error('Debio rechazar sin auth')
  return { status: result.status, code: result.data?.code }
})

// --- RESUMEN ---
console.log('\n=== Resumen ===')
const passed = results.filter((r) => r.status === 'PASS').length
const failed = results.filter((r) => r.status === 'FAIL').length
console.log(`${passed} passed, ${failed} failed de ${results.length} tests`)

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2))
console.log(`\nResultados guardados en ${OUTPUT_FILE}`)
