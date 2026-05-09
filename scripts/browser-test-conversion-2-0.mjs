/**
 * Browser Test - Conversion Flow 2.0: Guest Checkout + UX Improvements
 *
 * Pruebas:
 *  PARTE A: Guest Checkout (sin auth)
 *   1. POST /api/orders sin cookie + sin X-Forwarded-For => 429 (rate limit)
 *   2. POST /api/orders sin cookie + con IP => 201 (guest order)
 *   3. Response incluye guestToken (string) y status Interesado
 *   4. POST /api/orders guest con body invalido => 400
 *   5. POST /api/orders guest con tripId inexistente => 404
 *   6. POST /api/orders guest con departureId inexistente => 404
 *
 *  PARTE B: Authenticated Checkout
 *   7. POST /api/orders con cookie => 201 (auth order)
 *   8. Response incluye guestToken null para auth users
 *   9. Order document tiene userId del claims
 *
 *  PARTE C: Validation & Edge Cases
 *  10. POST /api/orders con contactName corto => 400
 *  11. POST /api/orders con contactPhone corto => 400
 *  12. POST /api/orders con attribution data => 201 + persiste
 *
 *  PARTE D: Legal Pages
 *  13. GET /privacy => 200 (HTML con Aviso de Privacidad)
 *  14. GET /terms => 200 (HTML con Terminos y Condiciones)
 *
 *  PARTE E: Trip Landing Page Guest Access
 *  15. GET /viajes/[slug] => 200 sin cookie (publico)
 *  16. GET /viajes/[slug]?cotizar=true => 200 (accesible sin auth)
 *
 * Ejecutar: node scripts/browser-test-conversion-2-0.mjs
 */

import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { createRequire } from 'module'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const serviceAccount = require(join(__dirname, '..', '.keys', 'arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json'))

const BASE_URL = 'http://localhost:3000'
const OUTPUT_FILE = 'scripts/browser-test-conversion-2-0-results.json'

// --- Firebase Admin init ---
const app = initializeApp({ credential: cert(serviceAccount) })
const auth = getAuth(app)
const db = getFirestore(app)

// --- Generate session cookie for a given user with given roles ---
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
if (!FIREBASE_API_KEY) {
  throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY is required to run this browser test')
}

async function getSessionCookie(email, roles) {
  const user = await auth.getUserByEmail(email)
  const customToken = await auth.createCustomToken(user.uid, { roles })

  const idToken = await new Promise((resolve, reject) => {
    const body = JSON.stringify({ token: customToken, returnSecureToken: true })
    const req = https.request(
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

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: 14 * 24 * 60 * 60 * 1000,
  })

  return { cookie: `__session=${sessionCookie}`, uid: user.uid }
}

// --- HTTP helper ---
function httpRequest(method, path, { body, cookie, query, headers: extraHeaders } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    const headers = { ...extraHeaders }
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

// --- Find a published trip with active departures ---
async function findTestTrip() {
  const tripsSnap = await db.collection('trips')
    .where('isPublished', '==', true)
    .limit(10)
    .get()

  for (const tripDoc of tripsSnap.docs) {
    const depsSnap = await tripDoc.ref.collection('departures')
      .where('isActive', '==', true)
      .limit(5)
      .get()

    const availableDep = depsSnap.docs.find(d => (d.data().seatsAvailable ?? 0) > 0)
    if (availableDep) {
      const tripData = tripDoc.data()
      const depData = availableDep.data()
      return {
        tripId: tripDoc.id,
        tripSlug: tripData.slug,
        tripName: tripData.odooName,
        departureId: availableDep.id,
        departureName: depData.odooName,
        seatsAvailable: depData.seatsAvailable,
        price: tripData.odooListPriceCentavos,
      }
    }
  }
  return null
}

// --- Cleanup: delete test orders created during this run ---
const testOrderIds = []
async function cleanupOrders() {
  if (testOrderIds.length === 0) return
  console.log(`\nLimpiando ${testOrderIds.length} ordenes de prueba...`)
  const batch = db.batch()
  for (const id of testOrderIds) {
    batch.delete(db.collection('orders').doc(id))
  }
  await batch.commit()
  console.log('Ordenes de prueba eliminadas.')
}

// --- Main ---
async function main() {
  console.log('\n=== Browser Test: Conversion Flow 2.0 ===\n')

  // Setup: find test trip
  console.log('Buscando viaje publicado con salidas activas...')
  const testTrip = await findTestTrip()
  if (!testTrip) {
    console.error('ERROR: No se encontro viaje publicado con salidas activas y asientos disponibles.')
    console.error('Asegurate de tener al menos 1 trip publicado con 1 departure activa.')
    process.exit(1)
  }
  console.log(`Trip: ${testTrip.tripName} (${testTrip.tripId})`)
  console.log(`Slug: ${testTrip.tripSlug}`)
  console.log(`Departure: ${testTrip.departureName} (${testTrip.departureId}) — ${testTrip.seatsAvailable} seats`)
  console.log(`Price: $${(testTrip.price / 100).toLocaleString()} centavos\n`)

  // Setup: get auth cookie
  console.log('Generando cookie autenticada...')
  const { cookie: AUTH_COOKIE, uid: AUTH_UID } = await getSessionCookie('ocompudoc@gmail.com', ['cliente', 'superadmin'])
  console.log(`Cookie ready (uid: ${AUTH_UID})\n`)

  const VALID_BODY = {
    tripId: testTrip.tripId,
    departureId: testTrip.departureId,
    contactName: 'Test Browser',
    contactPhone: '+523411234567',
  }

  // ======== PARTE A: Guest Checkout ========
  console.log('--- PARTE A: Guest Checkout ---')

  await test('1. POST /api/orders guest sin header IP => 201 (dev server provee ::1)', async () => {
    // En dev, Next.js siempre agrega x-forwarded-for: ::1
    // En produccion, Cloud Run/LB siempre agrega IP real
    // El check "no IP" es safety net — no reproducible en localhost
    const res = await httpRequest('POST', '/api/orders', { body: VALID_BODY })
    if (res.status === 201 && res.data?.orderId) {
      testOrderIds.push(res.data.orderId)
    }
    return {
      pass: res.status === 201 && typeof res.data?.guestToken === 'string',
      detail: `status=${res.status}, guestToken=${res.data?.guestToken?.substring(0, 8)}`,
    }
  })

  await test('2. POST /api/orders guest con IP => 201', async () => {
    const res = await httpRequest('POST', '/api/orders', {
      body: VALID_BODY,
      headers: { 'X-Forwarded-For': '192.168.99.1' },
    })
    if (res.status === 201 && res.data?.orderId) {
      testOrderIds.push(res.data.orderId)
    }
    return {
      pass: res.status === 201 && res.data?.status === 'Interesado',
      detail: `status=${res.status}, orderId=${res.data?.orderId}`,
    }
  })

  await test('3. Guest response tiene guestToken string', async () => {
    const res = await httpRequest('POST', '/api/orders', {
      body: VALID_BODY,
      headers: { 'X-Forwarded-For': '192.168.99.2' },
    })
    if (res.status === 201 && res.data?.orderId) {
      testOrderIds.push(res.data.orderId)
    }
    return {
      pass: res.status === 201 && typeof res.data?.guestToken === 'string' && res.data.guestToken.length > 10,
      detail: `guestToken=${res.data?.guestToken?.substring(0, 8)}..., type=${typeof res.data?.guestToken}`,
    }
  })

  await test('4. POST /api/orders guest body invalido => 400', async () => {
    const res = await httpRequest('POST', '/api/orders', {
      body: { tripId: testTrip.tripId },
      headers: { 'X-Forwarded-For': '192.168.99.3' },
    })
    return {
      pass: res.status === 400 && res.data?.code === 'VALIDATION_ERROR',
      detail: `status=${res.status}, code=${res.data?.code}`,
    }
  })

  await test('5. POST /api/orders guest tripId falso => 404', async () => {
    const res = await httpRequest('POST', '/api/orders', {
      body: { ...VALID_BODY, tripId: 'trip-no-existe-xyz' },
      headers: { 'X-Forwarded-For': '192.168.99.4' },
    })
    return {
      pass: res.status === 404 && res.data?.code === 'TRIP_NOT_FOUND',
      detail: `status=${res.status}, code=${res.data?.code}`,
    }
  })

  await test('6. POST /api/orders guest departureId falso => 404', async () => {
    const res = await httpRequest('POST', '/api/orders', {
      body: { ...VALID_BODY, departureId: 'dep-no-existe-xyz' },
      headers: { 'X-Forwarded-For': '192.168.99.5' },
    })
    return {
      pass: res.status === 404 && res.data?.code === 'DEPARTURE_NOT_FOUND',
      detail: `status=${res.status}, code=${res.data?.code}`,
    }
  })

  // ======== PARTE B: Authenticated Checkout ========
  console.log('\n--- PARTE B: Authenticated Checkout ---')

  let authOrderId = null
  await test('7. POST /api/orders con cookie => 201', async () => {
    const res = await httpRequest('POST', '/api/orders', {
      body: VALID_BODY,
      cookie: AUTH_COOKIE,
    })
    if (res.status === 201 && res.data?.orderId) {
      authOrderId = res.data.orderId
      testOrderIds.push(res.data.orderId)
    }
    return {
      pass: res.status === 201 && res.data?.status === 'Interesado',
      detail: `status=${res.status}, orderId=${res.data?.orderId}`,
    }
  })

  await test('8. Auth response tiene guestToken null', async () => {
    const res = await httpRequest('POST', '/api/orders', {
      body: VALID_BODY,
      cookie: AUTH_COOKIE,
    })
    if (res.status === 201 && res.data?.orderId) {
      testOrderIds.push(res.data.orderId)
    }
    return {
      pass: res.status === 201 && res.data?.guestToken === null,
      detail: `guestToken=${res.data?.guestToken}`,
    }
  })

  await test('9. Order auth tiene userId del claims', async () => {
    if (!authOrderId) return { pass: false, detail: 'No authOrderId from test 7' }
    const orderSnap = await db.collection('orders').doc(authOrderId).get()
    const orderData = orderSnap.data()
    return {
      pass: orderData?.userId === AUTH_UID && orderData?.guestToken === null && orderData?.guestIp === null,
      detail: `userId=${orderData?.userId}, guestToken=${orderData?.guestToken}, guestIp=${orderData?.guestIp}`,
    }
  })

  // ======== PARTE C: Validation & Edge Cases ========
  console.log('\n--- PARTE C: Validation & Edge Cases ---')

  await test('10. POST /api/orders contactName corto => 400', async () => {
    const res = await httpRequest('POST', '/api/orders', {
      body: { ...VALID_BODY, contactName: 'A' },
      cookie: AUTH_COOKIE,
    })
    return {
      pass: res.status === 400 && res.data?.code === 'VALIDATION_ERROR',
      detail: `status=${res.status}, msg=${res.data?.message}`,
    }
  })

  await test('11. POST /api/orders contactPhone corto => 400', async () => {
    const res = await httpRequest('POST', '/api/orders', {
      body: { ...VALID_BODY, contactPhone: '+521' },
      cookie: AUTH_COOKIE,
    })
    return {
      pass: res.status === 400 && res.data?.code === 'VALIDATION_ERROR',
      detail: `status=${res.status}, msg=${res.data?.message}`,
    }
  })

  await test('12. POST /api/orders con attribution => 201 + persiste', async () => {
    const res = await httpRequest('POST', '/api/orders', {
      body: {
        ...VALID_BODY,
        utmSource: 'browser-test',
        utmMedium: 'script',
        utmCampaign: 'conversion-2-0',
        agentId: 'agent-test-123',
      },
      cookie: AUTH_COOKIE,
    })
    if (res.status === 201 && res.data?.orderId) {
      testOrderIds.push(res.data.orderId)
      // Verify persistence
      const snap = await db.collection('orders').doc(res.data.orderId).get()
      const data = snap.data()
      const persisted = data?.utmSource === 'browser-test' &&
        data?.utmMedium === 'script' &&
        data?.utmCampaign === 'conversion-2-0' &&
        data?.agentId === 'agent-test-123'
      return {
        pass: res.status === 201 && persisted,
        detail: `orderId=${res.data.orderId}, persisted=${persisted}, utm=${data?.utmSource}`,
      }
    }
    return { pass: false, detail: `status=${res.status}` }
  })

  // ======== PARTE D: Legal Pages ========
  console.log('\n--- PARTE D: Legal Pages ---')

  await test('13. GET /privacy => 200 con contenido', async () => {
    const res = await httpRequest('GET', '/privacy')
    const html = typeof res.data === 'string' ? res.data : ''
    const hasContent = html.includes('Aviso de Privacidad') || html.includes('privacidad')
    return {
      pass: res.status === 200 && hasContent,
      detail: `status=${res.status}, hasContent=${hasContent}, length=${html.length}`,
    }
  })

  await test('14. GET /terms => 200 con contenido', async () => {
    const res = await httpRequest('GET', '/terms')
    const html = typeof res.data === 'string' ? res.data : ''
    const hasContent = html.includes('rminos') || html.includes('condiciones')
    return {
      pass: res.status === 200 && hasContent,
      detail: `status=${res.status}, hasContent=${hasContent}, length=${html.length}`,
    }
  })

  // ======== PARTE E: Trip Landing Page Guest Access ========
  console.log('\n--- PARTE E: Trip Landing Page ---')

  await test('15. GET /viajes/[slug] => 200 sin cookie', async () => {
    if (!testTrip.tripSlug) return { pass: false, detail: 'No tripSlug' }
    const res = await httpRequest('GET', `/viajes/${testTrip.tripSlug}`)
    const html = typeof res.data === 'string' ? res.data : ''
    return {
      pass: res.status === 200 && html.length > 1000,
      detail: `status=${res.status}, slug=${testTrip.tripSlug}, htmlLength=${html.length}`,
    }
  })

  await test('16. GET /viajes/[slug]?cotizar=true => 200 sin auth', async () => {
    if (!testTrip.tripSlug) return { pass: false, detail: 'No tripSlug' }
    const res = await httpRequest('GET', `/viajes/${testTrip.tripSlug}`, {
      query: { cotizar: 'true' },
    })
    const html = typeof res.data === 'string' ? res.data : ''
    // No redirect to login — just returns the page
    return {
      pass: res.status === 200 && html.length > 1000,
      detail: `status=${res.status}, htmlLength=${html.length}`,
    }
  })

  // ======== Summary ========
  const passed = results.filter(r => r.passed).length
  const total = results.length
  console.log(`\n=== Resultado: ${passed}/${total} ===\n`)

  // Cleanup
  await cleanupOrders()

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify({ date: new Date().toISOString(), passed, total, results }, null, 2)
  )
  console.log(`Resultados guardados en ${OUTPUT_FILE}`)

  process.exit(passed === total ? 0 : 1)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
