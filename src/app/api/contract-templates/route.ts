import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { AppError } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handleApiError'
import { PILOT_CONTRACT_TEMPLATES } from '@/lib/pdf/contracts/seedTemplates'
import { contractTemplateSchema } from '@/schemas/contractTemplateSchema'

const COLLECTION = 'contractTemplates'

async function ensureSeed(): Promise<void> {
  const snap = await adminDb.collection(COLLECTION).limit(1).get()
  if (!snap.empty) return

  const batch = adminDb.batch()
  for (const tpl of PILOT_CONTRACT_TEMPLATES) {
    const ref = adminDb.collection(COLLECTION).doc(tpl.templateKey)
    batch.set(ref, { ...tpl, templateId: tpl.templateKey })
  }
  await batch.commit()
}

/**
 * GET /api/contract-templates — Lista plantillas activas para selector admin.
 * Lazy-init los 5 destinos piloto si la colección está vacía.
 */
export async function GET() {
  try {
    const claims = await requireAuth()
    const roles = claims.roles ?? []
    if (!roles.some((r) => r === 'admin' || r === 'superadmin' || r === 'director')) {
      throw new AppError('FORBIDDEN', 'Requiere rol admin/superadmin/director', 403, false)
    }

    await ensureSeed()

    // Single-field orderBy NO requiere índice compuesto. El filtro `active=true`
    // se aplica en memoria — la colección es <10 docs (5 destinos piloto + future Paloma).
    const docs = await adminDb
      .collection(COLLECTION)
      .orderBy('destinoLabel', 'asc')
      .get()

    const templates = docs.docs
      .map((d) => {
        const data = d.data()
        const parsed = contractTemplateSchema.safeParse({ ...data, templateId: d.id })
        return parsed.success ? parsed.data : null
      })
      .filter((t): t is NonNullable<typeof t> => t !== null && t.active)

    return NextResponse.json({ templates })
  } catch (error) {
    return handleApiError(error)
  }
}
