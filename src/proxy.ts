import { type NextRequest, NextResponse } from 'next/server'

// Public pages that don't require authentication
const PUBLIC_PATHS = ['/', '/viajes', '/sobre-nosotros']
const PUBLIC_PREFIXES = ['/viajes/']

// Auth pages (login/register flow) — always accessible without auth
const AUTH_PATHS = ['/login', '/register', '/forgot-password']

// Default redirect target — no need to add returnUrl for this path
const DEFAULT_REDIRECT = '/dashboard'

/**
 * Option C (MVP): Proxy verifies cookie existence only.
 * Real token verification happens in Route Handlers via requireAuth().
 * Defense-in-depth: proxy is first layer, Route Handlers are second, Firestore Rules are third.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public pages — pass through without auth
  if (PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Auth pages — pass through without auth
  if (AUTH_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  // Protected routes — check session cookie existence
  const sessionCookie = request.cookies.get('__session')?.value

  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url)
    if (pathname !== DEFAULT_REDIRECT) {
      loginUrl.searchParams.set('returnUrl', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // Cookie exists — let Route Handlers do full verification via requireAuth()
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icons|images|sw.js).*)',
  ],
}
