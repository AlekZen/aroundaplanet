/**
 * Browser testing script for Story 1.4b - Route Protection
 * Tests proxy redirects, public routes, auth routes
 * Outputs results to scripts/browser-test-results.txt
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://localhost:3000'
const results = []
let passed = 0
let failed = 0

function log(msg) {
  results.push(msg)
  console.log(msg)
}

/**
 * Make HTTP request following redirects manually to capture redirect chain
 */
function request(urlPath, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE)
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: opts.method || 'GET',
      headers: opts.headers || {},
      // Don't follow redirects automatically
    }
    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => body += chunk)
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          location: res.headers.location || null,
          body: body.substring(0, 500), // truncate
        })
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function test(name, passed_bool, detail) {
  if (passed_bool) {
    passed++
    log(`  PASS: ${name}`)
  } else {
    failed++
    log(`  FAIL: ${name} -- ${detail}`)
  }
}

async function run() {
  log('=== Browser Test Suite: Story 1.4b Route Protection ===')
  log(`Date: ${new Date().toISOString()}`)
  log('')

  // ---- SECTION 1: Protected routes WITHOUT cookie → should redirect to /login ----
  log('--- 1. Protected routes sin cookie (expect redirect a /login) ---')

  const protectedRoutes = [
    { path: '/dashboard', expectReturnUrl: false },       // default redirect, no returnUrl
    { path: '/admin/verification', expectReturnUrl: true },
    { path: '/agent/dashboard', expectReturnUrl: true },
    { path: '/director/dashboard', expectReturnUrl: true },
    { path: '/superadmin/users', expectReturnUrl: true },
  ]

  for (const route of protectedRoutes) {
    try {
      const res = await request(route.path)
      const isRedirect = res.status === 307 || res.status === 308 || res.status === 302 || res.status === 301
      const redirectsToLogin = res.location && res.location.includes('/login')

      if (isRedirect && redirectsToLogin) {
        if (route.expectReturnUrl) {
          const hasReturnUrl = res.location.includes('returnUrl=')
          test(`${route.path} -> /login con returnUrl`, hasReturnUrl, `location: ${res.location}`)
        } else {
          const noReturnUrl = !res.location.includes('returnUrl=')
          test(`${route.path} -> /login sin returnUrl`, noReturnUrl, `location: ${res.location}`)
        }
      } else {
        // Next.js might return 200 with client-side redirect via RSC
        // Check if body contains redirect hints
        const bodyHasLogin = res.body.includes('/login') || res.body.includes('login')
        test(`${route.path} -> redirect to /login`, false, `status=${res.status}, location=${res.location}, bodyHasLogin=${bodyHasLogin}`)
      }
    } catch (err) {
      test(`${route.path} -> request failed`, false, err.message)
    }
  }

  log('')

  // ---- SECTION 2: Public routes WITHOUT cookie → should return 200 ----
  log('--- 2. Public routes sin cookie (expect 200 OK) ---')

  const publicRoutes = ['/', '/viajes', '/sobre-nosotros']

  for (const routePath of publicRoutes) {
    try {
      const res = await request(routePath)
      // 200 or 304 are both fine; also accept RSC streaming (200)
      const isOk = res.status === 200 || res.status === 304
      test(`${routePath} -> 200 OK`, isOk, `status=${res.status}`)
    } catch (err) {
      test(`${routePath} -> request failed`, false, err.message)
    }
  }

  log('')

  // ---- SECTION 3: Auth routes WITHOUT cookie → should return 200 ----
  log('--- 3. Auth routes sin cookie (expect 200 OK) ---')

  const authRoutes = ['/login', '/register', '/forgot-password']

  for (const routePath of authRoutes) {
    try {
      const res = await request(routePath)
      const isOk = res.status === 200 || res.status === 304
      test(`${routePath} -> 200 OK`, isOk, `status=${res.status}`)
    } catch (err) {
      test(`${routePath} -> request failed`, false, err.message)
    }
  }

  log('')

  // ---- SECTION 4: Public route with slug ----
  log('--- 4. Public route con slug /viajes/[slug] (expect 200) ---')

  try {
    const res = await request('/viajes/vuelta-al-mundo')
    const isOk = res.status === 200 || res.status === 304
    test(`/viajes/vuelta-al-mundo -> 200`, isOk, `status=${res.status}`)
  } catch (err) {
    test(`/viajes/vuelta-al-mundo -> request failed`, false, err.message)
  }

  log('')

  // ---- SECTION 5: API routes (should NOT be intercepted by proxy) ----
  log('--- 5. API routes no interceptadas por proxy ---')

  try {
    const res = await request('/api/auth/session')
    // Without cookie, should return 401 from the route handler, NOT a redirect
    const notRedirect = res.status !== 307 && res.status !== 302
    test(`/api/auth/session -> no redirect (status=${res.status})`, notRedirect, `got redirect to ${res.location}`)
  } catch (err) {
    test(`/api/auth/session -> request failed`, false, err.message)
  }

  log('')

  // ---- SECTION 6: Static assets not intercepted ----
  log('--- 6. Static assets no interceptados ---')

  const staticPaths = ['/favicon.ico', '/icons/icon-192x192.png']
  for (const sp of staticPaths) {
    try {
      const res = await request(sp)
      const notRedirect = res.status !== 307 && res.status !== 302
      test(`${sp} -> no redirect (status=${res.status})`, notRedirect, `redirected to ${res.location}`)
    } catch (err) {
      test(`${sp} -> request failed`, false, err.message)
    }
  }

  log('')

  // ---- SUMMARY ----
  log('=== RESUMEN ===')
  log(`Total: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`)
  log(failed === 0 ? 'ALL TESTS PASSED' : `${failed} TESTS FAILED - review above`)

  // Write to file
  const outPath = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'browser-test-results.txt')
  fs.writeFileSync(outPath, results.join('\n'), 'utf-8')
  log(`\nResults saved to: ${outPath}`)
}

run().catch(err => {
  console.error('Script error:', err)
  process.exit(1)
})
