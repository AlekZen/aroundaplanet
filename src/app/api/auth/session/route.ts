import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase/admin'
import { initUserClaims } from '@/lib/auth/claims'
import { linkGuestOrders } from '@/lib/orders/linkGuestOrders'

const SESSION_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

export async function POST(request: Request) {
  try {
    const { idToken, guestToken } = await request.json()

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { code: 'AUTH_MISSING_TOKEN', message: 'Token no proporcionado', retryable: false },
        { status: 400 }
      )
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken)

    // Story 1.4a: Set initial claims for new users (idempotent)
    await initUserClaims(decodedToken.uid)

    // Link guest orders if guestToken provided (Conversion 2.0)
    const tokenValue = typeof guestToken === 'string' ? guestToken : null
    await linkGuestOrders(decodedToken.uid, tokenValue)

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRY_MS,
    })

    const cookieStore = await cookies()
    cookieStore.set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_EXPIRY_MS / 1000,
      path: '/',
    })

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json(
      { code: 'AUTH_INVALID_TOKEN', message: 'Token invalido o expirado', retryable: false },
      { status: 401 }
    )
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.set('__session', '', { maxAge: 0, path: '/' })
  return new NextResponse(null, { status: 204 })
}
