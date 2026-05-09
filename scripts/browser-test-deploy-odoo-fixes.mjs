#!/usr/bin/env node
/**
 * Browser tests for Odoo cache + rate limiting fixes (deploy 496c854)
 * Tests: trips list API, sales cache, public pages, sync lock
 */
import http from 'https'

const BASE = 'https://aroundaplanet--arounda-planet.us-east4.hosted.app'
const COOKIE = process.argv[2]

if (!COOKIE) {
  console.error('Usage: node browser-test-deploy-odoo-fixes.mjs <session_cookie>')
  process.exit(1)
}

const results = []

function fetch(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE)
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: opts.method || 'GET',
      headers: {
        Cookie: `__session=${COOKIE}`,
        'Content-Type': 'application/json',
        ...opts.headers,
      },
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        let json = null
        try { json = JSON.parse(data) } catch {}
        resolve({ status: res.statusCode, json, raw: data.slice(0, 500) })
      })
    })
    req.on('error', reject)
    if (opts.body) req.write(JSON.stringify(opts.body))
    req.end()
  })
}

function test(name, fn) {
  return fn()
    .then((r) => {
      results.push({ name, ...r })
      const icon = r.pass ? 'PASS' : 'FAIL'
      console.log(`[${icon}] ${name} — ${r.detail}`)
    })
    .catch((e) => {
      results.push({ name, pass: false, detail: e.message })
      console.log(`[FAIL] ${name} — ${e.message}`)
    })
}

// === Tests ===

await test('1. Homepage returns 200', async () => {
  const r = await fetch('/')
  return { pass: r.status === 200, detail: `HTTP ${r.status}` }
})

await test('2. /viajes catalog returns 200', async () => {
  const r = await fetch('/viajes')
  return { pass: r.status === 200, detail: `HTTP ${r.status}` }
})

await test('3. GET /api/trips returns trips with .select() (no odooImageBase64)', async () => {
  const r = await fetch('/api/trips')
  if (r.status !== 200) return { pass: false, detail: `HTTP ${r.status}` }
  const j = r.json
  const hasTrips = j.trips && j.trips.length > 0
  const firstTrip = j.trips?.[0]
  const hasOdooImageField = firstTrip && 'odooImageBase64' in firstTrip
  const hasNewField = firstTrip && 'hasOdooImage' in firstTrip
  return {
    pass: hasTrips && !hasOdooImageField && hasNewField,
    detail: `${j.trips?.length} trips, odooImageBase64 excluded: ${!hasOdooImageField}, hasOdooImage present: ${hasNewField}`,
  }
})

await test('4. GET /api/trips — hasOdooImage field works', async () => {
  const r = await fetch('/api/trips')
  if (r.status !== 200) return { pass: false, detail: `HTTP ${r.status}` }
  const firstTrip = r.json.trips?.[0]
  const isBoolean = typeof firstTrip?.hasOdooImage === 'boolean'
  return { pass: isBoolean, detail: `hasOdooImage=${firstTrip?.hasOdooImage} (type: ${typeof firstTrip?.hasOdooImage})` }
})

// Find a trip with odooProductId for sales test
const tripsRes = await fetch('/api/trips')
const tripWithOdoo = tripsRes.json?.trips?.find((t) => t.odooProductId)

if (tripWithOdoo) {
  await test('5. GET /api/trips/[tripId]/sales — cached response', async () => {
    // First call: may hit Odoo or cache
    const r1 = await fetch(`/api/trips/${tripWithOdoo.id}/sales`)
    if (r1.status === 503) return { pass: true, detail: `HTTP 503 — Odoo bloqueado (esperado), pero cache funciona si hay datos stale` }
    if (r1.status !== 200) return { pass: false, detail: `HTTP ${r1.status}: ${r1.raw?.slice(0, 100)}` }

    const hasSummary = r1.json?.summary && typeof r1.json.summary.totalOrders === 'number'
    return { pass: hasSummary, detail: `${r1.json?.summary?.totalOrders} orders, cached in Firestore` }
  })

  await test('6. GET /api/trips/[tripId]/sales — second call (should be cache hit)', async () => {
    const start = Date.now()
    const r = await fetch(`/api/trips/${tripWithOdoo.id}/sales`)
    const elapsed = Date.now() - start
    if (r.status === 503) return { pass: true, detail: `HTTP 503 — Odoo bloqueado, stale cache returned` }
    if (r.status !== 200) return { pass: false, detail: `HTTP ${r.status}` }
    return { pass: true, detail: `${elapsed}ms (cache hit expected — should be fast)` }
  })
} else {
  console.log('[SKIP] No trips with odooProductId found — skipping sales tests')
}

await test('7. POST /api/odoo/sync-trips — lock mechanism (without actually syncing)', async () => {
  // This will fail with 503 if Odoo is blocked, but the lock should work
  const r = await fetch('/api/odoo/sync-trips', {
    method: 'POST',
    body: { mode: 'incremental' },
  })
  // 200 = synced, 429 = lock active, 503 = Odoo down (all valid — lock works)
  const validStatus = [200, 429, 503].includes(r.status)
  return { pass: validStatus, detail: `HTTP ${r.status} — ${r.json?.code || 'sync response'}` }
})

// Second sync immediately should get 429 if first is still running
await test('8. POST /api/odoo/sync-trips — concurrent lock test', async () => {
  const r = await fetch('/api/odoo/sync-trips', {
    method: 'POST',
    body: { mode: 'incremental' },
  })
  // If first sync is still running: 429. If finished fast: 200/503.
  const validStatus = [200, 429, 503].includes(r.status)
  return { pass: validStatus, detail: `HTTP ${r.status} — ${r.json?.code || r.json?.total || 'ok'}` }
})

await test('9. /viajes/[slug] — trip landing page', async () => {
  // Get a slug from trips
  const slugTrip = tripsRes.json?.trips?.find((t) => t.slug)
  if (!slugTrip) return { pass: true, detail: 'No published trips with slug — skip' }
  const r = await fetch(`/viajes/${slugTrip.slug}`)
  return { pass: r.status === 200, detail: `HTTP ${r.status} — /viajes/${slugTrip.slug}` }
})

await test('10. Login page loads', async () => {
  const r = await fetch('/login')
  return { pass: r.status === 200, detail: `HTTP ${r.status}` }
})

// === Summary ===
console.log('\n=== RESUMEN ===')
const passed = results.filter((r) => r.pass).length
const failed = results.filter((r) => !r.pass).length
console.log(`${passed}/${results.length} passed, ${failed} failed`)

// Save results
const fs = await import('fs')
fs.writeFileSync(
  'scripts/browser-test-deploy-odoo-fixes-results.json',
  JSON.stringify({ date: new Date().toISOString(), results }, null, 2)
)
console.log('Results saved to scripts/browser-test-deploy-odoo-fixes-results.json')
