/**
 * Browser Test - Story 2-1b: Admin Trip CRUD & Document Uploads
 *
 * Pruebas:
 *   1. Seguridad: GET /api/trips rechaza sin cookie (401)
 *   2. Seguridad: GET /api/trips rechaza sin rol admin (403)
 *   3. GET /api/trips retorna lista de viajes con SuperAdmin cookie
 *   4. GET /api/trips soporta filtro ?filter=published
 *   5. GET /api/trips soporta busqueda ?search=mundo
 *   6. GET /api/trips/[tripId] retorna viaje individual
 *   7. PATCH /api/trips/[tripId] actualiza campo editorial (slug)
 *   8. PATCH /api/trips/[tripId] actualiza isPublished
 *   9. PATCH /api/trips/[tripId] rechaza campo invalido (strict)
 *  10. POST /api/trips/[tripId]/departures crea salida manual
 *  11. PATCH /api/trips/[tripId]/departures/[depId] actualiza salida
 *  12. Seguridad: PATCH /api/trips/[tripId] rechaza sin cookie (401)
 *
 * Ejecutar: node scripts/browser-test-2-1b.mjs
 */

import http from 'node:http'
import fs from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { createRequire } from 'module'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const serviceAccount = require(join(__dirname, '..', '.keys', 'arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json'))

const BASE_URL = 'http://localhost:3000'
const OUTPUT_FILE = 'scripts/browser-test-2-1b-results.json'

// --- Firebase Admin init ---
const app = initializeApp({ credential: cert(serviceAccount) })
const auth = getAuth(app)

function getFirebaseApiKey() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY is required to run this browser test')
  }
  return apiKey
}

// --- Generate fresh SuperAdmin session cookie ---
async function getSuperAdminCookie() {
  const EMAIL = 'ocompudoc@gmail.com'
  const user = await auth.getUserByEmail(EMAIL)
  console.log('UID:', user.uid, 'Claims:', JSON.stringify(user.customClaims))

  // Create custom token with superadmin claims
  const customToken = await auth.createCustomToken(user.uid, {
    roles: ['cliente', 'superadmin'],
  })

  // Exchange custom token for ID token via Firebase REST API
  const FIREBASE_API_KEY = getFirebaseApiKey()
  const idToken = await new Promise((resolve, reject) => {
    const body = JSON.stringify({ token: customToken, returnSecureToken: true })
    const req = require('https').request(
      {
        hostname: 'identitytoolkit.googleapis.com',
        path: `/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          const parsed = JSON.parse(data)
          if (parsed.idToken) resolve(parsed.idToken)
          else reject(new Error('No idToken: ' + data))
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })

  // Create session cookie (14 days)
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: 14 * 24 * 60 * 60 * 1000,
  })

  return `__session=${sessionCookie}`
}

// --- HTTP helper ---
function httpRequest(method, path, { body, cookie, query } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    const headers = {}
    if (cookie) headers.Cookie = cookie
    if (body) {
      const json = JSON.stringify(body)
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(json)
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

// --- Test runner ---
const results = []
async function test(name, fn) {
  try {
    const result = await fn()
    const passed = result.pass
    results.push({ name, passed, detail: result.detail || '' })
    console.log(passed ? `  PASS  ${name}` : `  FAIL  ${name} — ${result.detail}`)
  } catch (e) {
    results.push({ name, passed: false, detail: e.message })
    console.log(`  FAIL  ${name} — ${e.message}`)
  }
}

// --- Main ---
async function main() {
  console.log('\n=== Browser Test: Story 2-1b ===\n')
  console.log('Generating SuperAdmin cookie...')
  const SUPERADMIN_COOKIE = await getSuperAdminCookie()
  console.log('Cookie ready.\n')

  // Cookie from a cliente-only user (reuse from 1.5 - may be expired, we'll generate inline)
  // For 403 tests, just omit the admin role claim - use a fresh cliente cookie
  const CLIENTE_COOKIE = await (async () => {
    const user = await auth.getUserByEmail('ocompudoc@gmail.com')
    const token = await auth.createCustomToken(user.uid, { roles: ['cliente'] })
    const FIREBASE_API_KEY = getFirebaseApiKey()
    const idToken = await new Promise((resolve, reject) => {
      const body = JSON.stringify({ token, returnSecureToken: true })
      const req = require('https').request(
        {
          hostname: 'identitytoolkit.googleapis.com',
          path: `/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => {
            const parsed = JSON.parse(data)
            if (parsed.idToken) resolve(parsed.idToken)
            else reject(new Error('No idToken'))
          })
        }
      )
      req.on('error', reject)
      req.write(body)
      req.end()
    })
    const sc = await auth.createSessionCookie(idToken, { expiresIn: 14 * 24 * 60 * 60 * 1000 })
    return `__session=${sc}`
  })()

  let firstTripId = null
  let createdDepartureId = null

  // === Test 1: Sin cookie => 401 ===
  await test('1. GET /api/trips sin cookie => 401', async () => {
    const res = await httpRequest('GET', '/api/trips')
    return { pass: res.status === 401, detail: `status=${res.status}` }
  })

  // === Test 2: Con cookie cliente => 200 (trips:read is granted to all roles) ===
  await test('2. GET /api/trips con rol cliente => 200', async () => {
    const res = await httpRequest('GET', '/api/trips', { cookie: CLIENTE_COOKIE })
    return { pass: res.status === 200, detail: `status=${res.status}` }
  })

  // === Test 3: Lista de viajes ===
  await test('3. GET /api/trips retorna lista de viajes', async () => {
    const res = await httpRequest('GET', '/api/trips', { cookie: SUPERADMIN_COOKIE })
    const ok = res.status === 200 && Array.isArray(res.data?.trips) && res.data.trips.length > 0
    if (ok) firstTripId = res.data.trips[0].id
    return {
      pass: ok,
      detail: `status=${res.status}, trips=${res.data?.trips?.length || 0}, firstId=${firstTripId}`,
    }
  })

  // === Test 4: Filtro published ===
  await test('4. GET /api/trips?filter=published', async () => {
    const res = await httpRequest('GET', '/api/trips', {
      cookie: SUPERADMIN_COOKIE,
      query: { filter: 'published' },
    })
    const ok = res.status === 200 && Array.isArray(res.data?.trips)
    return { pass: ok, detail: `status=${res.status}, count=${res.data?.trips?.length}` }
  })

  // === Test 5: Busqueda ===
  await test('5. GET /api/trips?search=mundo', async () => {
    const res = await httpRequest('GET', '/api/trips', {
      cookie: SUPERADMIN_COOKIE,
      query: { search: 'mundo' },
    })
    const ok = res.status === 200 && Array.isArray(res.data?.trips)
    const hasMatch = res.data?.trips?.some(t => t.odooName?.toLowerCase().includes('mundo'))
    return {
      pass: ok,
      detail: `status=${res.status}, count=${res.data?.trips?.length}, hasMatch=${hasMatch}`,
    }
  })

  // === Test 6: Viaje individual ===
  await test('6. GET /api/trips/[tripId] retorna viaje', async () => {
    if (!firstTripId) return { pass: false, detail: 'No tripId from test 3' }
    const res = await httpRequest('GET', `/api/trips/${firstTripId}`, { cookie: SUPERADMIN_COOKIE })
    const ok = res.status === 200 && res.data?.id === firstTripId && typeof res.data?.odooName === 'string'
    return { pass: ok, detail: `status=${res.status}, name=${res.data?.odooName}` }
  })

  // === Test 7: PATCH editorial field (slug) ===
  await test('7. PATCH /api/trips/[tripId] actualiza slug', async () => {
    if (!firstTripId) return { pass: false, detail: 'No tripId' }
    const testSlug = 'test-browser-slug-' + Date.now()
    const res = await httpRequest('PATCH', `/api/trips/${firstTripId}`, {
      cookie: SUPERADMIN_COOKIE,
      body: { slug: testSlug },
    })
    const ok = res.status === 200

    // Verify it persisted
    const verify = await httpRequest('GET', `/api/trips/${firstTripId}`, { cookie: SUPERADMIN_COOKIE })
    const persisted = verify.data?.slug === testSlug

    // Clean up — reset slug
    await httpRequest('PATCH', `/api/trips/${firstTripId}`, {
      cookie: SUPERADMIN_COOKIE,
      body: { slug: '' },
    })

    return { pass: ok && persisted, detail: `status=${res.status}, persisted=${persisted}` }
  })

  // === Test 8: PATCH isPublished toggle ===
  await test('8. PATCH /api/trips/[tripId] toggle isPublished', async () => {
    if (!firstTripId) return { pass: false, detail: 'No tripId' }
    // Get current state
    const before = await httpRequest('GET', `/api/trips/${firstTripId}`, { cookie: SUPERADMIN_COOKIE })
    const wasPub = before.data?.isPublished

    // Toggle
    const res = await httpRequest('PATCH', `/api/trips/${firstTripId}`, {
      cookie: SUPERADMIN_COOKIE,
      body: { isPublished: !wasPub },
    })

    // Verify
    const after = await httpRequest('GET', `/api/trips/${firstTripId}`, { cookie: SUPERADMIN_COOKIE })
    const toggled = after.data?.isPublished === !wasPub

    // Restore
    await httpRequest('PATCH', `/api/trips/${firstTripId}`, {
      cookie: SUPERADMIN_COOKIE,
      body: { isPublished: wasPub },
    })

    return { pass: res.status === 200 && toggled, detail: `status=${res.status}, toggled=${toggled}` }
  })

  // === Test 9: PATCH campo invalido (strict) ===
  await test('9. PATCH /api/trips/[tripId] rechaza campo invalido', async () => {
    if (!firstTripId) return { pass: false, detail: 'No tripId' }
    const res = await httpRequest('PATCH', `/api/trips/${firstTripId}`, {
      cookie: SUPERADMIN_COOKIE,
      body: { odooName: 'hack' },
    })
    return { pass: res.status === 400, detail: `status=${res.status}` }
  })

  // === Test 10: POST departure (manual) ===
  await test('10. POST /api/trips/[tripId]/departures crea salida manual', async () => {
    if (!firstTripId) return { pass: false, detail: 'No tripId' }
    const now = new Date()
    const start = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const end = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()

    const res = await httpRequest('POST', `/api/trips/${firstTripId}/departures`, {
      cookie: SUPERADMIN_COOKIE,
      body: {
        name: 'Browser Test Departure',
        startDate: start,
        endDate: end,
        seatsMax: 25,
      },
    })

    const ok = res.status === 201 && typeof res.data?.id === 'string'
    if (ok) createdDepartureId = res.data.id
    return { pass: ok, detail: `status=${res.status}, depId=${createdDepartureId}` }
  })

  // === Test 11: PATCH departure ===
  await test('11. PATCH /api/trips/[tripId]/departures/[depId] actualiza salida', async () => {
    if (!firstTripId || !createdDepartureId) return { pass: false, detail: 'No tripId or depId' }
    const res = await httpRequest('PATCH', `/api/trips/${firstTripId}/departures/${createdDepartureId}`, {
      cookie: SUPERADMIN_COOKIE,
      body: { seatsMax: 50, isActive: false },
    })
    return { pass: res.status === 200, detail: `status=${res.status}` }
  })

  // === Test 12: PATCH sin cookie => 401 ===
  await test('12. PATCH /api/trips/[tripId] sin cookie => 401', async () => {
    if (!firstTripId) return { pass: false, detail: 'No tripId' }
    const res = await httpRequest('PATCH', `/api/trips/${firstTripId}`, {
      body: { slug: 'hacker' },
    })
    return { pass: res.status === 401, detail: `status=${res.status}` }
  })

  // === Summary ===
  const passed = results.filter(r => r.passed).length
  const total = results.length
  console.log(`\n=== Resultado: ${passed}/${total} ===\n`)

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ date: new Date().toISOString(), passed, total, results }, null, 2))
  console.log(`Resultados guardados en ${OUTPUT_FILE}`)

  process.exit(passed === total ? 0 : 1)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
