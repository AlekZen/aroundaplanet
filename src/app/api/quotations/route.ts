import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'
import { createQuotationSchema, quotationDocumentSchema } from '@/schemas/quotationSchema'
import { tryAuth } from '@/lib/auth/tryAuth'

export const runtime = 'nodejs'

const COLLECTION = 'quotations'

// Rate limit en memoria del proceso (best-effort anti-abuse; Cloud Run min=1 hace que sea
// suficiente para frenar bursts simples; defensa real es Firestore rules de create).
const ipBuckets = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60 * 1000
const MAX_PER_WINDOW = 10

function rateLimitCheck(ip: string): boolean {
  const now = Date.now()
  const bucket = ipBuckets.get(ip)
  if (!bucket || bucket.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  bucket.count += 1
  return bucket.count <= MAX_PER_WINDOW
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * POST /api/quotations — Persistir lead `/cotizar` antes de abrir WhatsApp.
 * Endpoint público (sin auth) con rate-limit por IP. Si la sesión existe, registra createdBy.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request)
    if (!rateLimitCheck(ip)) {
      throw new AppError('RATE_LIMIT', 'Demasiadas solicitudes, intenta en un minuto', 429, true)
    }

    const body = await request.json().catch(() => ({}))
    const parsed = createQuotationSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Datos inválidos',
        400
      )
    }

    if (parsed.data.source !== 'cotizar-public') {
      throw new AppError(
        'FORBIDDEN',
        'Source admin-manual no disponible vía endpoint público',
        403
      )
    }

    const claims = await tryAuth()
    const createdBy = claims?.uid ?? null

    const ref = adminDb.collection(COLLECTION).doc()
    const docData = {
      quotationId: ref.id,
      source: parsed.data.source,
      leadSnapshot: parsed.data.leadSnapshot,
      status: 'lead' as const,
      pdfUrl: null,
      pdfStoragePath: null,
      pdfVersion: 0,
      whatsappSent: parsed.data.whatsappSent,
      createdBy,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    // Validamos shape persistido contra schema (sin timestamps)
    const validation = quotationDocumentSchema.safeParse({
      ...docData,
      pdfUrl: null,
    })
    if (!validation.success) {
      throw new AppError(
        'INTERNAL_VALIDATION',
        validation.error.issues[0]?.message ?? 'Shape interno inválido',
        500
      )
    }

    await ref.set(docData)
    return NextResponse.json({ quotationId: ref.id }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
