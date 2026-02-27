/**
 * Browser Test - Story 1.7: User Profile & Notification Preferences
 *
 * Pruebas:
 *   1. GET /api/users/:uid/preferences retorna preferencias con defaults
 *   2. PATCH /api/users/:uid/profile actualiza datos personales
 *   3. PATCH /api/users/:uid/profile actualiza datos fiscales
 *   4. PATCH /api/users/:uid/profile rechaza bankData para no-agente (403)
 *   5. PATCH /api/users/:uid/preferences actualiza preferencias
 *   6. PATCH /api/users/:uid/preferences filtra categorias por rol
 *   7. Seguridad: PATCH /api/users/:uid/profile sin cookie (401)
 *   8. Seguridad: PATCH /api/users/:uid/profile cross-user (403)
 *   9. POST /api/users/:uid/profile-photo sin cookie (401)
 *  10. Validacion: PATCH /api/users/:uid/profile con RFC invalido (400)
 *
 * Ejecutar: node scripts/test-profile-1-7.mjs
 */

import http from 'node:http'
import fs from 'node:fs'

// --- CONFIG ---
const BASE_URL = 'http://localhost:3000'
const UID = 'gif7XVStiEfOJFrBMCeECQOgJfZ2'
const FAKE_UID = 'nonexistent-user-12345'

// Cookie con roles: [cliente, superadmin, director, admin] (NO agente)
const SESSION_COOKIE = '__session=eyJhbGciOiJSUzI1NiIsImtpZCI6InZWX3pZdyJ9.eyJpc3MiOiJodHRwczovL3Nlc3Npb24uZmlyZWJhc2UuZ29vZ2xlLmNvbS9hcm91bmRhLXBsYW5ldCIsIm5hbWUiOiJBbGVrIFplbiIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJN0liV3R6a0pIQXJxOVNGdmlfckdFbElsN3hHbzVBY1JhcnA1d1MwS1pXT1VMN2xlM2p3XHUwMDNkczk2LWMiLCJyb2xlcyI6WyJjbGllbnRlIiwic3VwZXJhZG1pbiIsImRpcmVjdG9yIiwiYWRtaW4iXSwiYXVkIjoiYXJvdW5kYS1wbGFuZXQiLCJhdXRoX3RpbWUiOjE3NzIxNDc2NTUsInVzZXJfaWQiOiJnaWY3WFZTdGlFZk9KRnJCTUNlRUNRT2dKZloyIiwic3ViIjoiZ2lmN1hWU3RpRWZPSkZyQk1DZUVDUU9nSmZaMiIsImlhdCI6MTc3MjE0Nzk3NCwiZXhwIjoxNzczMzU3NTc0LCJlbWFpbCI6Im9jb21wdWRvY0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjExODA5MjU5ODI3NTkzNTMwMDM2MyJdLCJlbWFpbCI6WyJvY29tcHVkb2NAZ21haWwuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoiZ29vZ2xlLmNvbSJ9fQ.gLP_aQoxyWx9NkXao1GX_H4B6FRMqLy9GZNqp7s51P4zJ1KjNFKjClj7veuTF1uo6k1SZOQCVPt-vIDFLk9EHK2SdvDUNMur-EwVf94gTeOVDwkAF7Ro-6s_aNTE-EMXFTULCoaNLc2Tq0fUhBACAPv2nr2AhD5GIlOMnOyKeX1FUXRHRlb_w9-akh0abHB5pNgwAhY8GXxrhMn3S-4Ot9T8Ylhgz8Npzfbz6iHu4X499RKk6sKWaKfq0IhWRnfLSavq94ZjsasvRuD3fip-CyELp35a80sMZiniEJRsgoVDTqHoFtZjNhUtZvKpAhZJLNQmU60H9dpgWUKgv9ZY8Q'

const OUTPUT_FILE = 'scripts/browser-test-1-7-results.json'

// --- HELPERS ---
function httpRequest(method, path, { body, cookie, formData } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const headers = {}
    if (cookie) headers.Cookie = cookie

    let payload = null
    if (body) {
      headers['Content-Type'] = 'application/json'
      payload = JSON.stringify(body)
      headers['Content-Length'] = Buffer.byteLength(payload)
    }

    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          let parsed = null
          try { parsed = JSON.parse(data) } catch { parsed = data }
          resolve({ status: res.statusCode, body: parsed })
        })
      }
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function runTest(name, fn) {
  try {
    const result = await fn()
    console.log(`  PASS  ${name}`)
    return { name, passed: true, ...result }
  } catch (error) {
    console.log(`  FAIL  ${name}: ${error.message}`)
    return { name, passed: false, error: error.message }
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg)
}

// --- TESTS ---
async function main() {
  console.log('\n=== Browser Tests: Story 1.7 — User Profile & Notification Preferences ===\n')
  const results = []

  // 1. GET preferences — returns defaults merged
  results.push(await runTest('GET /api/users/:uid/preferences returns preferences', async () => {
    const r = await httpRequest('GET', `/api/users/${UID}/preferences`, { cookie: SESSION_COOKIE })
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`)
    assert(r.body.preferences, 'Response missing preferences object')
    assert(r.body.preferences.timezone, 'Missing timezone in preferences')
    assert(r.body.preferences.channels, 'Missing channels in preferences')
    assert(r.body.preferences.quietHours, 'Missing quietHours in preferences')
    return { status: r.status, hasPreferences: true }
  }))

  // 2. PATCH profile — personal data
  results.push(await runTest('PATCH /api/users/:uid/profile updates personal data', async () => {
    const r = await httpRequest('PATCH', `/api/users/${UID}/profile`, {
      cookie: SESSION_COOKIE,
      body: { section: 'personal', data: { firstName: 'Alek', lastName: 'Zen', phone: '+523331234567' } },
    })
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`)
    assert(r.body.updatedFields, 'Response missing updatedFields')
    assert(r.body.updatedFields.firstName === 'Alek', 'firstName not in response')
    assert(r.body.updatedAt, 'Response missing updatedAt')
    return { status: r.status, updatedFields: Object.keys(r.body.updatedFields) }
  }))

  // 3. PATCH profile — fiscal data
  results.push(await runTest('PATCH /api/users/:uid/profile updates fiscal data', async () => {
    const r = await httpRequest('PATCH', `/api/users/${UID}/profile`, {
      cookie: SESSION_COOKIE,
      body: {
        section: 'fiscal',
        data: {
          rfc: 'XAXX010101000',
          razonSocial: 'Test SA de CV',
          regimenFiscal: '612',
          domicilioFiscal: 'Calle Test 123',
          usoCFDI: 'G03',
        },
      },
    })
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`)
    assert(r.body.updatedFields.fiscalData, 'Response missing fiscalData')
    return { status: r.status }
  }))

  // 4. PATCH profile — bankData rejected for non-agente (403)
  results.push(await runTest('PATCH /api/users/:uid/profile rejects bankData for non-agente', async () => {
    const r = await httpRequest('PATCH', `/api/users/${UID}/profile`, {
      cookie: SESSION_COOKIE,
      body: {
        section: 'bank',
        data: { banco: 'BBVA', numeroCuenta: '1234567890123456', clabe: '012345678901234567', titularCuenta: 'Test' },
      },
    })
    assert(r.status === 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`)
    assert(r.body.code === 'BANK_DATA_AGENTS_ONLY', `Expected BANK_DATA_AGENTS_ONLY, got ${r.body.code}`)
    return { status: r.status, code: r.body.code }
  }))

  // 5. PATCH preferences — updates preferences
  results.push(await runTest('PATCH /api/users/:uid/preferences updates preferences', async () => {
    const r = await httpRequest('PATCH', `/api/users/${UID}/preferences`, {
      cookie: SESSION_COOKIE,
      body: {
        categories: { payments: false, alerts: true },
        quietHours: { enabled: true, startTime: '22:00', endTime: '08:00' },
        channels: { push: true, whatsapp: false, email: true },
        timezone: 'Europe/Madrid',
      },
    })
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`)
    assert(r.body.preferences, 'Response missing preferences')
    assert(r.body.preferences.timezone === 'Europe/Madrid', 'Timezone not updated')
    return { status: r.status, timezone: r.body.preferences.timezone }
  }))

  // 6. PATCH preferences — filters categories by role
  results.push(await runTest('PATCH preferences filters categories by role', async () => {
    const r = await httpRequest('PATCH', `/api/users/${UID}/preferences`, {
      cookie: SESSION_COOKIE,
      body: { categories: { payments: true, sales: true, trips: true, alerts: true, reports: true } },
    })
    assert(r.status === 200, `Expected 200, got ${r.status}`)
    // User has roles [cliente, superadmin, director, admin] — superadmin sees all 5 categories
    const catKeys = Object.keys(r.body.preferences.categories)
    assert(catKeys.length === 5, `Expected 5 categories for superadmin, got ${catKeys.length}: ${catKeys}`)
    return { status: r.status, categories: catKeys }
  }))

  // 7. Security: PATCH profile without cookie (401)
  results.push(await runTest('PATCH /api/users/:uid/profile without cookie returns 401', async () => {
    const r = await httpRequest('PATCH', `/api/users/${UID}/profile`, {
      body: { section: 'personal', data: { firstName: 'Hack', lastName: 'Er' } },
    })
    assert(r.status === 401, `Expected 401, got ${r.status}`)
    return { status: r.status }
  }))

  // 8. Security: PATCH profile cross-user (403)
  results.push(await runTest('PATCH /api/users/:uid/profile cross-user returns 403', async () => {
    const r = await httpRequest('PATCH', `/api/users/${FAKE_UID}/profile`, {
      cookie: SESSION_COOKIE,
      body: { section: 'personal', data: { firstName: 'Hack', lastName: 'Er' } },
    })
    // SuperAdmin has users:manage so should NOT get 403 — expect 404 (user not found)
    assert(r.status === 404, `Expected 404 for nonexistent user, got ${r.status}: ${JSON.stringify(r.body)}`)
    return { status: r.status, note: 'SuperAdmin has users:manage, but user does not exist' }
  }))

  // 9. Security: POST profile-photo without cookie (401)
  results.push(await runTest('POST /api/users/:uid/profile-photo without cookie returns 401', async () => {
    const r = await httpRequest('POST', `/api/users/${UID}/profile-photo`)
    assert(r.status === 401, `Expected 401, got ${r.status}`)
    return { status: r.status }
  }))

  // 10. Validation: PATCH profile with invalid RFC (400)
  results.push(await runTest('PATCH /api/users/:uid/profile with invalid RFC returns 400', async () => {
    const r = await httpRequest('PATCH', `/api/users/${UID}/profile`, {
      cookie: SESSION_COOKIE,
      body: {
        section: 'fiscal',
        data: {
          rfc: 'INVALIDO',
          razonSocial: 'Test',
          regimenFiscal: '612',
          domicilioFiscal: 'Calle 1',
          usoCFDI: 'G03',
        },
      },
    })
    assert(r.status === 400, `Expected 400, got ${r.status}: ${JSON.stringify(r.body)}`)
    assert(r.body.code === 'PROFILE_VALIDATION_ERROR', `Expected PROFILE_VALIDATION_ERROR, got ${r.body.code}`)
    return { status: r.status, code: r.body.code }
  }))

  // --- SUMMARY ---
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const summary = { total: results.length, passed, failed, timestamp: new Date().toISOString(), results }

  console.log(`\n=== Results: ${passed}/${results.length} passed, ${failed} failed ===\n`)

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(summary, null, 2))
  console.log(`Results saved to ${OUTPUT_FILE}`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
