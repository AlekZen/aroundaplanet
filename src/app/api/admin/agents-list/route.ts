import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'

export const runtime = 'nodejs'

/**
 * Story 10.6 AC5 — GET /api/admin/agents-list
 *
 * Lista compacta de usuarios con rol `agente` para el dropdown del banner
 * "Asignar agente" en `/admin/orders/[orderId]`. Devuelve solo lo mínimo
 * necesario (uid + displayName) para alimentar el select.
 */
export async function GET() {
  try {
    await requirePermission('users:read')

    const snap = await adminDb
      .collection('users')
      .where('roles', 'array-contains', 'agente')
      .limit(500)
      .get()

    const agents = snap.docs
      .map((doc) => {
        const d = doc.data()
        const full = `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim()
        const name = (d.displayName as string | undefined) ?? (full || null) ?? doc.id
        return { uid: doc.id, name, email: d.email ?? null }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es-MX'))

    return NextResponse.json({ agents })
  } catch (error) {
    return handleApiError(error)
  }
}
