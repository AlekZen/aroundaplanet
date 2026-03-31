import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { createContactSchema } from '@/schemas/contactSchema'

const COLLECTION = 'agentContacts'

export async function POST(request: NextRequest) {
  try {
    const claims = await requireAuth()

    if (!claims.agentId) {
      throw new AppError('FORBIDDEN', 'Se requiere rol de agente', 403, false)
    }

    const body = await request.json()
    const parsed = createContactSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos inválidos', retryable: false },
        { status: 400 }
      )
    }

    const { name, email, phone, mobile, city } = parsed.data

    const contactData = {
      agentId: claims.agentId,
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      mobile: mobile?.trim() || null,
      city: city?.trim() || null,
      source: 'platform' as const,
      odooPartnerId: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    const docRef = await adminDb.collection(COLLECTION).add(contactData)

    return NextResponse.json(
      { contactId: docRef.id, ...contactData, createdAt: null, updatedAt: null },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET() {
  try {
    const claims = await requireAuth()

    const agentId = claims.agentId

    if (!agentId) {
      // Admin/superadmin sin agentId propio no pueden listar sin parámetro
      const hasAdminRole = claims.roles.some((r) =>
        ['admin', 'director', 'superadmin'].includes(r)
      )
      if (!hasAdminRole) {
        throw new AppError('FORBIDDEN', 'Se requiere rol de agente', 403, false)
      }
      throw new AppError('VALIDATION_ERROR', 'Se requiere parámetro agentId para admin', 400, false)
    }

    const snapshot = await adminDb
      .collection(COLLECTION)
      .where('agentId', '==', agentId)
      .orderBy('name')
      .get()

    const contacts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    return NextResponse.json({ contacts, total: contacts.length })
  } catch (error) {
    return handleApiError(error)
  }
}
