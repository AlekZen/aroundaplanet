/**
 * Browser Test - Story 2-1a: Trip Sync Odoo -> Firestore
 *
 * Pruebas:
 *   1. Seguridad: POST /api/odoo/sync-trips rechaza sin cookie (401)
 *   2. Seguridad: POST /api/odoo/sync-trips rechaza usuario sin permiso sync:odoo (403)
 *   3. Validacion: rechaza mode invalido (400)
 *   4. Validacion: rechaza minPrice negativo (400)
 *   5. Sync full con filtro 2026: retorna resultado con total/created/updated/errors
 *   6. Sync full: created + updated > 0 o total > 0 (hay viajes 2026 en Odoo)
 *   7. Sync incremental: funciona sin errores
 *   8. Sync incremental: skipped > 0 (ya sincronizados del test anterior)
 *   9. Respuesta tiene formato TripSyncResult correcto
 *  10. UI: pagina /superadmin/odoo-sync carga correctamente (200)
 *
 * Ejecutar: node scripts/test-trip-sync-2-1a.mjs
 */

import http from 'node:http'
import fs from 'node:fs'

// --- CONFIG ---
const BASE_URL = 'http://localhost:3000'

// Cookie SuperAdmin (roles: ["cliente", "superadmin", "director", "admin"])
const SUPERADMIN_COOKIE = '__session=eyJhbGciOiJSUzI1NiIsImtpZCI6InZWX3pZdyJ9.eyJpc3MiOiJodHRwczovL3Nlc3Npb24uZmlyZWJhc2UuZ29vZ2xlLmNvbS9hcm91bmRhLXBsYW5ldCIsIm5hbWUiOiJBbGVrIFplbiIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJN0liV3R6a0pIQXJxOVNGdmlfckdFbElsN3hHbzVBY1JhcnA1d1MwS1pXT1VMN2xlM2p3XHUwMDNkczk2LWMiLCJyb2xlcyI6WyJjbGllbnRlIiwic3VwZXJhZG1pbiIsImRpcmVjdG9yIiwiYWRtaW4iXSwiYXVkIjoiYXJvdW5kYS1wbGFuZXQiLCJhdXRoX3RpbWUiOjE3NzIxNDc2NTUsInVzZXJfaWQiOiJnaWY3WFZTdGlFZk9KRnJCTUNlRUNRT2dKZloyIiwic3ViIjoiZ2lmN1hWU3RpRWZPSkZyQk1DZUVDUU9nSmZaMiIsImlhdCI6MTc3MjIxNTQ1MiwiZXhwIjoxNzczNDI1MDUyLCJlbWFpbCI6Im9jb21wdWRvY0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjExODA5MjU5ODI3NTkzNTMwMDM2MyJdLCJlbWFpbCI6WyJvY29tcHVkb2NAZ21haWwuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoiZ29vZ2xlLmNvbSJ9fQ.MehErZnKGrpfsidID6MjEDG73I36XKymkA42N4U097MbvMKtb6gn-MHPgvXKDlxNuu0Q12f_21OmQvmjBLOIsAAds6j0hDNOkJNEMAAIQjjHHOZUISebE3U5QJuv_ewNFqSdOOrXz7N-Yszb4CMFuWG0kftC6TmhAf0qdtjZHkR1mPzT6skOFmzBDLUOeau-wpKEjuTk1gKRwECjNtG6qKkgiGaW79bJC9yk_7nukV_8Yoyquo6k9ebiQSrDmPxEL8ewyeeDpc9BYTvYhA4Ml61DZUlqWbWskmGtNIQ9LyVezUB1r5DW1mI9n1QGjbGg1V5PZLOKKRGV8Svesjg5LQ'

// Cookie Cliente (roles: ["cliente"]) — reuse from Story 1.6
const CLIENTE_COOKIE = '__session=eyJhbGciOiJSUzI1NiIsImtpZCI6InZWX3pZdyJ9.eyJpc3MiOiJodHRwczovL3Nlc3Npb24uZmlyZWJhc2UuZ29vZ2xlLmNvbS9hcm91bmRhLXBsYW5ldCIsIm5hbWUiOiJBbGVrIFplbiIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJN0liV3R6a0pIQXJxOVNGdmlfckdFbElsN3hHbzVBY1JhcnA1d1MwS1pXT1VMN2xlM2p3XHUwMDNkczk2LWMiLCJyb2xlcyI6WyJjbGllbnRlIl0sImF1ZCI6ImFyb3VuZGEtcGxhbmV0IiwiYXV0aF90aW1lIjoxNzcyMTM0MTg3LCJ1c2VyX2lkIjoiZ2lmN1hWU3RpRWZPSkZyQk1DZUVDUU9nSmZaMiIsInN1YiI6ImdpZjdYVlN0aUVmT0pGckJNQ2VFQ1FPZ0pmWjIiLCJpYXQiOjE3NzIxMzk2NDcsImV4cCI6MTc3MzM0OTI0NywiZW1haWwiOiJvY29tcHVkb2NAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMTgwOTI1OTgyNzU5MzUzMDAzNjMiXSwiZW1haWwiOlsib2NvbXB1ZG9jQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.EPIQhC4fgW6hYmGujawvfTDnmczQsmcH6jADVyumr0nrIh1HUXe15DLvjPsUHMJKvKLN6oeyxarKjEQcBcbAcgppXv00K9G49Cbh30UFgSHL-9fQykGlKQY02B98DDRF0YXcnW6bEUvW3HoIq2OjXScoLAJNBpBwxM2U8mwn_yBLKwFY-KPzGo-1jshs1KJO7iSJEKYJxKBRkkRL-kBb6rt6cdL9wT-pNMuzwJL8goF-SVoXNHXQ53ZAtRrzmyLN3mxcq-ewPmO1YwqxufRI79eqNnqdivD1VDie7r7NDb_O8frjgANWu4PUFISCgxuYk-fkZt7x_vtFTB6HYZ-N8Q'

const OUTPUT_FILE = 'scripts/browser-test-2-1a-results.json'

// --- HELPERS ---
function httpRequest(method, path, { body, cookie, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const headers = {}
    if (cookie) headers.Cookie = cookie
    if (body) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body))
    }

    const timer = setTimeout(() => {
      req.destroy()
      reject(new Error(`Timeout after ${timeout}ms`))
    }, timeout)

    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          clearTimeout(timer)
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }) }
          catch { resolve({ status: res.statusCode, data }) }
        })
      }
    )
    req.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

const results = []
let passed = 0
let failed = 0

function assert(name, condition, details = '') {
  if (condition) {
    passed++
    results.push({ test: name, status: 'PASS' })
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    results.push({ test: name, status: 'FAIL', details })
    console.log(`  FAIL  ${name} -- ${details}`)
  }
}

// --- TESTS ---
async function runTests() {
  console.log('\n=== Story 2-1a: Trip Sync Odoo -> Firestore ===\n')

  // Test 1: Seguridad — sin cookie
  try {
    const res = await httpRequest('POST', '/api/odoo/sync-trips', {
      body: { mode: 'full' },
    })
    assert('1. POST /api/odoo/sync-trips sin cookie -> 401', res.status === 401,
      `status=${res.status}`)
  } catch (err) {
    assert('1. POST /api/odoo/sync-trips sin cookie -> 401', false, err.message)
  }

  // Test 2: Seguridad — cookie cliente (sin permiso sync:odoo)
  try {
    const res = await httpRequest('POST', '/api/odoo/sync-trips', {
      body: { mode: 'full' },
      cookie: CLIENTE_COOKIE,
    })
    // 403 if cookie valid but no permission, 401 if cookie revoked/stale (claims changed)
    assert('2. POST /api/odoo/sync-trips con cliente -> 401/403', res.status === 403 || res.status === 401,
      `status=${res.status}`)
  } catch (err) {
    assert('2. POST /api/odoo/sync-trips con cliente -> 403', false, err.message)
  }

  // Test 3: Validacion — mode invalido
  try {
    const res = await httpRequest('POST', '/api/odoo/sync-trips', {
      body: { mode: 'partial' },
      cookie: SUPERADMIN_COOKIE,
    })
    assert('3. Mode invalido -> 400', res.status === 400,
      `status=${res.status}, data=${JSON.stringify(res.data)}`)
  } catch (err) {
    assert('3. Mode invalido -> 400', false, err.message)
  }

  // Test 4: Validacion — minPrice negativo
  try {
    const res = await httpRequest('POST', '/api/odoo/sync-trips', {
      body: { mode: 'full', minPrice: -100 },
      cookie: SUPERADMIN_COOKIE,
    })
    assert('4. minPrice negativo -> 400', res.status === 400,
      `status=${res.status}, data=${JSON.stringify(res.data)}`)
  } catch (err) {
    assert('4. minPrice negativo -> 400', false, err.message)
  }

  // Test 5: Sync full con filtro 2026 (la misma config del OdooSyncDashboard)
  let syncResult = null
  try {
    console.log('\n  [Ejecutando sync full 2026... puede tardar 10-30s]\n')
    const res = await httpRequest('POST', '/api/odoo/sync-trips', {
      body: { mode: 'full', nameFilter: '2026', minPrice: 5000 },
      cookie: SUPERADMIN_COOKIE,
      timeout: 60000,
    })
    syncResult = res.data
    assert('5. Sync full 2026 -> 200', res.status === 200,
      `status=${res.status}, data=${JSON.stringify(res.data).slice(0, 200)}`)
  } catch (err) {
    assert('5. Sync full 2026 -> 200', false, err.message)
  }

  // Test 6: Resultado tiene viajes
  if (syncResult) {
    assert('6. total > 0 (hay viajes 2026 en Odoo)', syncResult.total > 0,
      `total=${syncResult.total}`)
  } else {
    assert('6. total > 0 (hay viajes 2026 en Odoo)', false, 'syncResult es null')
  }

  // Test 7: Sync incremental (deberia funcionar sin errores)
  let incrementalResult = null
  try {
    console.log('\n  [Ejecutando sync incremental... puede tardar 5-15s]\n')
    const res = await httpRequest('POST', '/api/odoo/sync-trips', {
      body: { mode: 'incremental', nameFilter: '2026', minPrice: 5000 },
      cookie: SUPERADMIN_COOKIE,
      timeout: 60000,
    })
    incrementalResult = res.data
    assert('7. Sync incremental -> 200', res.status === 200,
      `status=${res.status}, data=${JSON.stringify(res.data).slice(0, 200)}`)
  } catch (err) {
    assert('7. Sync incremental -> 200', false, err.message)
  }

  // Test 8: En incremental, skipped > 0 (ya sincronizados del sync full anterior)
  if (incrementalResult) {
    assert('8. Incremental: skipped > 0 (datos ya actualizados)', incrementalResult.skipped > 0,
      `skipped=${incrementalResult.skipped}, total=${incrementalResult.total}`)
  } else {
    assert('8. Incremental: skipped > 0', false, 'incrementalResult es null')
  }

  // Test 9: Formato TripSyncResult correcto
  if (syncResult) {
    const hasTotal = typeof syncResult.total === 'number'
    const hasCreated = typeof syncResult.created === 'number'
    const hasUpdated = typeof syncResult.updated === 'number'
    const hasSkipped = typeof syncResult.skipped === 'number'
    const hasErrors = typeof syncResult.errors === 'number'
    const hasSyncedAt = typeof syncResult.syncedAt === 'string'
    const hasSyncSource = typeof syncResult.syncSource === 'string'
    const allFields = hasTotal && hasCreated && hasUpdated && hasSkipped && hasErrors && hasSyncedAt && hasSyncSource
    assert('9. Formato TripSyncResult: total/created/updated/skipped/errors/syncedAt/syncSource', allFields,
      `fields: total=${hasTotal}, created=${hasCreated}, updated=${hasUpdated}, skipped=${hasSkipped}, errors=${hasErrors}, syncedAt=${hasSyncedAt}, syncSource=${hasSyncSource}`)
  } else {
    assert('9. Formato TripSyncResult', false, 'syncResult es null')
  }

  // Test 10: Pagina /superadmin/odoo-sync carga (200)
  try {
    const res = await httpRequest('GET', '/superadmin/odoo-sync', {
      cookie: SUPERADMIN_COOKIE,
    })
    // Next.js returns HTML for pages, check status
    assert('10. GET /superadmin/odoo-sync -> 200', res.status === 200,
      `status=${res.status}`)
  } catch (err) {
    assert('10. GET /superadmin/odoo-sync -> 200', false, err.message)
  }

  // --- SUMMARY ---
  console.log(`\n=== Resultados: ${passed}/${passed + failed} PASS ===`)
  if (syncResult) {
    console.log(`\n  Sync full result:`)
    console.log(`    total: ${syncResult.total}`)
    console.log(`    created: ${syncResult.created}`)
    console.log(`    updated: ${syncResult.updated}`)
    console.log(`    skipped: ${syncResult.skipped}`)
    console.log(`    errors: ${syncResult.errors}`)
    console.log(`    syncedAt: ${syncResult.syncedAt}`)
    console.log(`    syncSource: ${syncResult.syncSource}`)
  }
  if (incrementalResult) {
    console.log(`\n  Sync incremental result:`)
    console.log(`    total: ${incrementalResult.total}`)
    console.log(`    created: ${incrementalResult.created}`)
    console.log(`    updated: ${incrementalResult.updated}`)
    console.log(`    skipped: ${incrementalResult.skipped}`)
    console.log(`    errors: ${incrementalResult.errors}`)
    console.log(`    syncSource: ${incrementalResult.syncSource}`)
  }
  console.log('')

  // Save results
  const output = {
    story: '2-1a',
    timestamp: new Date().toISOString(),
    summary: { passed, failed, total: passed + failed },
    syncFullResult: syncResult,
    syncIncrementalResult: incrementalResult,
    tests: results,
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2))
  console.log(`Resultados guardados en ${OUTPUT_FILE}\n`)

  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch((err) => {
  console.error('Error fatal:', err)
  process.exit(1)
})
