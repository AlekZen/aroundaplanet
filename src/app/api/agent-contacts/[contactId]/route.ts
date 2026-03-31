import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'

const CONTACTS_COLLECTION = 'agentContacts'
const ORDERS_COLLECTION = 'orders'
const PAYMENTS_COLLECTION = 'payments'
const TRIPS_COLLECTION = 'trips'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const claims = await requireAuth()
    const { contactId } = await params

    // Fetch contact and verify ownership
    const contactSnap = await adminDb.collection(CONTACTS_COLLECTION).doc(contactId).get()

    if (!contactSnap.exists) {
      throw new AppError('NOT_FOUND', 'Contacto no encontrado', 404, false)
    }

    const contactData = contactSnap.data()!
    const isOwner = claims.agentId === contactData.agentId
    const isAdmin = claims.roles.some((r) =>
      ['admin', 'director', 'superadmin'].includes(r)
    )

    if (!isOwner && !isAdmin) {
      throw new AppError('FORBIDDEN', 'Sin acceso a este contacto', 403, false)
    }

    // Fetch orders for this contact
    const ordersSnap = await adminDb
      .collection(ORDERS_COLLECTION)
      .where('agentContactId', '==', contactId)
      .orderBy('createdAt', 'desc')
      .get()

    // Batch-fetch trip names
    const tripIds = [...new Set(ordersSnap.docs.map((d) => d.data().tripId as string))]
    const tripNames: Record<string, string> = {}
    if (tripIds.length > 0) {
      const tripSnaps = await Promise.all(
        tripIds.map((id) => adminDb.collection(TRIPS_COLLECTION).doc(id).get())
      )
      for (const snap of tripSnaps) {
        if (snap.exists) {
          tripNames[snap.id] = (snap.data()?.odooName as string) ?? 'Viaje sin nombre'
        }
      }
    }

    const orders = ordersSnap.docs.map((doc) => {
      const d = doc.data()
      return {
        orderId: doc.id,
        orderName: tripNames[d.tripId] ?? 'Viaje no encontrado',
        tripId: d.tripId,
        status: d.status ?? 'Interesado',
        amountTotalCents: d.amountTotalCents ?? 0,
        amountPaidCents: d.amountPaidCents ?? 0,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
      }
    })

    // Batch-fetch payments for all orders (in batches of 30 — Firestore 'in' limit)
    const orderIds = orders.map((o) => o.orderId)
    const payments: Array<Record<string, unknown>> = []

    for (let i = 0; i < orderIds.length; i += 30) {
      const batch = orderIds.slice(i, i + 30)
      const paymentsSnap = await adminDb
        .collection(PAYMENTS_COLLECTION)
        .where('orderId', 'in', batch)
        .get()

      for (const doc of paymentsSnap.docs) {
        const p = doc.data()
        payments.push({
          paymentId: doc.id,
          orderId: p.orderId,
          amountCents: p.amountCents ?? 0,
          method: p.method ?? null,
          status: p.status ?? 'pending_verification',
          receiptUrl: p.receiptUrl ?? null,
          createdAt: p.createdAt?.toDate?.()?.toISOString() ?? null,
        })
      }
    }

    const contact = {
      id: contactSnap.id,
      name: contactData.name,
      email: contactData.email ?? null,
      phone: contactData.phone ?? null,
      mobile: contactData.mobile ?? null,
      city: contactData.city ?? null,
      source: contactData.source,
      odooPartnerId: contactData.odooPartnerId ?? null,
      createdAt: contactData.createdAt?.toDate?.()?.toISOString() ?? null,
    }

    return NextResponse.json({ contact, orders, payments })
  } catch (error) {
    return handleApiError(error)
  }
}
