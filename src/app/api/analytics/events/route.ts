import { NextRequest, NextResponse } from 'next/server'
import { tryAuth } from '@/lib/auth/tryAuth'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { analyticsEventSchema } from '@/schemas/analyticsEventSchema'
import { writeAnalyticsEvent } from '@/lib/analytics-server'
import { adminDb } from '@/lib/firebase/admin'

const RATE_LIMIT_COLLECTION = 'analyticsRateLimit'
const GUEST_RATE_LIMIT = 30  // per minute
const AUTH_RATE_LIMIT = 60   // per minute
const RATE_WINDOW_MS = 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const claims = await tryAuth()

    const body = await request.json()
    const parsed = analyticsEventSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Tipo de evento invalido', retryable: false },
        { status: 400 }
      )
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rateLimitKey = claims?.uid ?? `guest:${ip}`
    const limit = claims ? AUTH_RATE_LIMIT : GUEST_RATE_LIMIT
    const windowStart = new Date(Date.now() - RATE_WINDOW_MS)

    const recentCount = await adminDb
      .collection(RATE_LIMIT_COLLECTION)
      .where('key', '==', rateLimitKey)
      .where('timestamp', '>=', windowStart)
      .count()
      .get()

    if (recentCount.data().count >= limit) {
      return NextResponse.json(
        { code: 'RATE_LIMITED', message: 'Demasiados eventos — intenta mas tarde', retryable: true },
        { status: 429 }
      )
    }

    // Track rate limit entry (expireAt enables Firestore TTL auto-deletion)
    await adminDb.collection(RATE_LIMIT_COLLECTION).add({
      key: rateLimitKey,
      timestamp: new Date(),
      expireAt: new Date(Date.now() + RATE_WINDOW_MS * 2),
    })

    const { type, metadata } = parsed.data

    const eventId = await writeAnalyticsEvent({
      type,
      userId: claims?.uid,
      metadata,
      ip,
    })

    return NextResponse.json({ eventId }, { status: 201 })
  } catch (error) {
    if (error instanceof AppError) {
      return handleApiError(error)
    }
    // For analytics, silently accept — don't return 500 to client
    return NextResponse.json({ eventId: null }, { status: 202 })
  }
}
