/**
 * Browser Test - Story 1.6: SuperAdmin Panel & User Management
 *
 * Pruebas:
 *   1. Seguridad: GET /api/users rechaza sin cookie (401)
 *   2. Seguridad: GET /api/users rechaza usuario sin rol superadmin (403)
 *   3. GET /api/users retorna lista de usuarios con SuperAdmin cookie
 *   4. GET /api/users soporta filtro por rol
 *   5. GET /api/users soporta filtro por estado
 *   6. GET /api/users soporta busqueda por nombre/email
 *   7. Seguridad: PATCH /api/users/:uid/status rechaza sin cookie (401)
 *   8. Seguridad: PATCH /api/users/:uid/status rechaza sin rol superadmin (403)
 *   9. PATCH /api/users/:uid/status valida body con Zod
 *  10. Seguridad: POST /api/odoo/sync-users rechaza sin cookie (401)
 *  11. Seguridad: POST /api/odoo/sync-users rechaza sin rol superadmin (403)
 *
 * Ejecutar: node scripts/test-superadmin-1-6.mjs
 */

import http from 'node:http'
import fs from 'node:fs'

// --- CONFIG ---
const BASE_URL = 'http://localhost:3000'

// Cookie SuperAdmin (roles: ["cliente", "superadmin"])
const SUPERADMIN_COOKIE = '__session=eyJhbGciOiJSUzI1NiIsImtpZCI6InZWX3pZdyJ9.eyJpc3MiOiJodHRwczovL3Nlc3Npb24uZmlyZWJhc2UuZ29vZ2xlLmNvbS9hcm91bmRhLXBsYW5ldCIsIm5hbWUiOiJBbGVrIFplbiIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJN0liV3R6a0pIQXJxOVNGdmlfckdFbElsN3hHbzVBY1JhcnA1d1MwS1pXT1VMN2xlM2p3XHUwMDNkczk2LWMiLCJyb2xlcyI6WyJjbGllbnRlIiwic3VwZXJhZG1pbiJdLCJhdWQiOiJhcm91bmRhLXBsYW5ldCIsImF1dGhfdGltZSI6MTc3MjEzOTgzMSwidXNlcl9pZCI6ImdpZjdYVlN0aUVmT0pGckJNQ2VFQ1FPZ0pmWjIiLCJzdWIiOiJnaWY3WFZTdGlFZk9KRnJCTUNlRUNRT2dKZloyIiwiaWF0IjoxNzcyMTM5ODMxLCJleHAiOjE3NzMzNDk0MzEsImVtYWlsIjoib2NvbXB1ZG9jQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7Imdvb2dsZS5jb20iOlsiMTE4MDkyNTk4Mjc1OTM1MzAwMzYzIl0sImVtYWlsIjpbIm9jb21wdWRvY0BnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJjdXN0b20ifX0.qYseEpfWU5MHl0BE2s5krU9riaFfhHdGB44OaO7nM1d1QPUkhxJk-wtOLjgWDP9S_HOthuP7I3mT2PmRN3-R0V1slS3TMue901KZVJh8tQWPHzvWYCAIBSoBrMeYTA6w_cDxCB_nnCBCGfKpbefqvWzz1T31eWtY-Su-MkKHNlPo2yjo5JtT2zRb0okeR3U8yM4fFptLK-v25pHmnnrEF_PjYpTNm_TFdCn2pkhBDM-mGIQFzM5gsXL5p_Y7-KkiepH_rXP0VSzuXIpmr9n_DCB5ldaexcLofyjCuaUcq4lZ0P_EGEmVVeh6vgvYBGdzC2RQVYOovYWP4MvXEjSBkA'

// Cookie Cliente (roles: ["cliente"]) — para tests de seguridad 403
const CLIENTE_COOKIE = '__session=eyJhbGciOiJSUzI1NiIsImtpZCI6InZWX3pZdyJ9.eyJpc3MiOiJodHRwczovL3Nlc3Npb24uZmlyZWJhc2UuZ29vZ2xlLmNvbS9hcm91bmRhLXBsYW5ldCIsIm5hbWUiOiJBbGVrIFplbiIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJN0liV3R6a0pIQXJxOVNGdmlfckdFbElsN3hHbzVBY1JhcnA1d1MwS1pXT1VMN2xlM2p3XHUwMDNkczk2LWMiLCJyb2xlcyI6WyJjbGllbnRlIl0sImF1ZCI6ImFyb3VuZGEtcGxhbmV0IiwiYXV0aF90aW1lIjoxNzcyMTM0MTg3LCJ1c2VyX2lkIjoiZ2lmN1hWU3RpRWZPSkZyQk1DZUVDUU9nSmZaMiIsInN1YiI6ImdpZjdYVlN0aUVmT0pGckJNQ2VFQ1FPZ0pmWjIiLCJpYXQiOjE3NzIxMzk2NDcsImV4cCI6MTc3MzM0OTI0NywiZW1haWwiOiJvY29tcHVkb2NAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMTgwOTI1OTgyNzU5MzUzMDAzNjMiXSwiZW1haWwiOlsib2NvbXB1ZG9jQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.EPIQhC4fgW6hYmGujawvfTDnmczQsmcH6jADVyumr0nrIh1HUXe15DLvjPsUHMJKvKLN6oeyxarKjEQcBcbAcgppXv00K9G49Cbh30UFgSHL-9fQykGlKQY02B98DDRF0YXcnW6bEUvW3HoIq2OjXScoLAJNBpBwxM2U8mwn_yBLKwFY-KPzGo-1jshs1KJO7iSJEKYJxKBRkkRL-kBb6rt6cdL9wT-pNMuzwJL8goF-SVoXNHXQ53ZAtRrzmyLN3mxcq-ewPmO1YwqxufRI79eqNnqdivD1VDie7r7NDb_O8frjgANWu4PUFISCgxuYk-fkZt7x_vtFTB6HYZ-N8Q'

const OUTPUT_FILE = 'scripts/browser-test-1-6-results.json'

// --- HELPERS ---
function httpRequest(method, path, { body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const headers = {}
    if (cookie) headers.Cookie = cookie
    if (body) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body))
    }

    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }) }
          catch { resolve({ status: res.statusCode, data }) }
        })
      }
    )
    req.on('error', reject)
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
    console.log(`  FAIL  ${name} — ${details}`)
  }
}

// --- TESTS ---
async function runTests() {
  console.log('\n=== Story 1.6: SuperAdmin Panel & User Management ===\n')
  console.log('--- Seguridad: GET /api/users ---')

  // Test 1: Sin cookie → 401
  {
    const res = await httpRequest('GET', '/api/users')
    assert('GET /api/users sin cookie → 401', res.status === 401, `got ${res.status}`)
  }

  // Test 2: Con cookie cliente → 403
  {
    const res = await httpRequest('GET', '/api/users', { cookie: CLIENTE_COOKIE })
    assert('GET /api/users con cliente → 403', res.status === 403, `got ${res.status}`)
  }

  // Test 3: Con cookie superadmin → 200 + lista usuarios
  console.log('\n--- API: GET /api/users (SuperAdmin) ---')
  let userUid = null
  {
    const res = await httpRequest('GET', '/api/users', { cookie: SUPERADMIN_COOKIE })
    const hasUsers = res.status === 200 && Array.isArray(res.data?.users)
    assert('GET /api/users con superadmin → 200 + users array', hasUsers, `status=${res.status}, data=${JSON.stringify(res.data).substring(0, 200)}`)
    if (hasUsers && res.data.users.length > 0) {
      userUid = res.data.users[0].uid
      console.log(`    -> ${res.data.total} usuarios encontrados, primer uid: ${userUid}`)
    }
  }

  // Test 4: Filtro por rol
  {
    const res = await httpRequest('GET', '/api/users?roleFilter=cliente', { cookie: SUPERADMIN_COOKIE })
    assert('GET /api/users?roleFilter=cliente → 200', res.status === 200, `got ${res.status}`)
  }

  // Test 5: Filtro por estado
  {
    const res = await httpRequest('GET', '/api/users?statusFilter=active', { cookie: SUPERADMIN_COOKIE })
    assert('GET /api/users?statusFilter=active → 200', res.status === 200, `got ${res.status}`)
  }

  // Test 6: Busqueda por texto
  {
    const res = await httpRequest('GET', '/api/users?search=alek', { cookie: SUPERADMIN_COOKIE })
    assert('GET /api/users?search=alek → 200', res.status === 200, `got ${res.status}`)
  }

  // --- PATCH /api/users/:uid/status ---
  console.log('\n--- Seguridad: PATCH /api/users/:uid/status ---')

  // Test 7: Sin cookie → 401
  {
    const res = await httpRequest('PATCH', '/api/users/fake-uid/status', { body: { isActive: false } })
    assert('PATCH /api/users/:uid/status sin cookie → 401', res.status === 401, `got ${res.status}`)
  }

  // Test 8: Con cookie cliente → 403
  {
    const res = await httpRequest('PATCH', '/api/users/fake-uid/status', { cookie: CLIENTE_COOKIE, body: { isActive: false } })
    assert('PATCH /api/users/:uid/status con cliente → 403', res.status === 403, `got ${res.status}`)
  }

  // Test 9: Validacion Zod — body invalido
  {
    const res = await httpRequest('PATCH', '/api/users/fake-uid/status', { cookie: SUPERADMIN_COOKIE, body: { invalid: true } })
    assert('PATCH /api/users/:uid/status body invalido → 400', res.status === 400, `got ${res.status}: ${JSON.stringify(res.data).substring(0, 100)}`)
  }

  // --- POST /api/odoo/sync-users ---
  console.log('\n--- Seguridad: POST /api/odoo/sync-users ---')

  // Test 10: Sin cookie → 401
  {
    const res = await httpRequest('POST', '/api/odoo/sync-users')
    assert('POST /api/odoo/sync-users sin cookie → 401', res.status === 401, `got ${res.status}`)
  }

  // Test 11: Con cookie cliente → 403
  {
    const res = await httpRequest('POST', '/api/odoo/sync-users', { cookie: CLIENTE_COOKIE })
    assert('POST /api/odoo/sync-users con cliente → 403', res.status === 403, `got ${res.status}`)
  }

  // --- RESULTADOS ---
  console.log(`\n=== Resultados: ${passed} passed, ${failed} failed de ${passed + failed} ===\n`)

  const output = {
    story: '1.6',
    timestamp: new Date().toISOString(),
    summary: { total: passed + failed, passed, failed },
    results,
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2))
  console.log(`Resultados guardados en ${OUTPUT_FILE}`)

  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch((err) => {
  console.error('Error fatal:', err)
  process.exit(1)
})
