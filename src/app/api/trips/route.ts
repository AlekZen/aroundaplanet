import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { tripListQuerySchema } from '@/schemas/tripSchema'

const TRIPS_COLLECTION = 'trips'
const DEPARTURES_SUBCOLLECTION = 'departures'

/**
 * GET /api/trips — Paginated trip list for Admin panel
 * Query params: search, filter, cursor, pageSize
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission('trips:read')

    const { searchParams } = request.nextUrl
    const parsed = tripListQuerySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Parametros invalidos', retryable: false },
        { status: 400 }
      )
    }

    const { pageSize, search, filter, cursor } = parsed.data
    const tripsRef = adminDb.collection(TRIPS_COLLECTION)

    // Small dataset (<200 trips) — fetch all, filter in memory
    let query: FirebaseFirestore.Query = tripsRef.orderBy('odooName')

    if (filter === 'published') {
      query = query.where('isPublished', '==', true)
    } else if (filter === 'draft') {
      query = query.where('isPublished', '==', false)
    }

    const allSnapshot = await query.get()
    let trips = allSnapshot.docs.map((doc) => {
      const d = doc.data()
      return {
        id: doc.id,
        odooName: d.odooName ?? '',
        odooListPriceCentavos: d.odooListPriceCentavos ?? 0,
        odooCurrencyCode: d.odooCurrencyCode ?? 'MXN',
        odooCategory: d.odooCategory ?? '',
        isPublished: d.isPublished ?? false,
        isActive: d.isActive ?? true,
        slug: d.slug ?? '',
        emotionalCopy: d.emotionalCopy ?? '',
        tags: d.tags ?? [],
        highlights: d.highlights ?? [],
        difficulty: d.difficulty ?? null,
        seoTitle: d.seoTitle ?? '',
        seoDescription: d.seoDescription ?? '',
        heroImages: d.heroImages ?? [],
        hasOdooImage: typeof d.odooImageBase64 === 'string' && d.odooImageBase64.length > 0,
        odooProductId: d.odooProductId ?? null,
        odooSalesCount: d.odooSalesCount ?? 0,
        odooIsFavorite: d.odooIsFavorite ?? false,
        odooDocumentCount: d.odooDocumentCount ?? 0,
        lastSyncAt: d.lastSyncAt ?? null,
        nextDepartureDate: d.nextDepartureDate ?? null,
        nextDepartureEndDate: d.nextDepartureEndDate ?? null,
        totalDepartures: d.totalDepartures ?? 0,
        totalSeatsMax: d.totalSeatsMax ?? 0,
        totalSeatsAvailable: d.totalSeatsAvailable ?? 0,
      }
    })

    // In-memory search
    if (search) {
      const searchLower = search.toLowerCase()
      trips = trips.filter((t) => {
        const name = (t as Record<string, unknown>).odooName
        return typeof name === 'string' && name.toLowerCase().includes(searchLower)
      })
    }

    // Filter: with-departures requires subcollection check
    if (filter === 'with-departures') {
      const withDeps = await Promise.all(
        trips.map(async (trip) => {
          const depSnap = await tripsRef.doc(trip.id).collection(DEPARTURES_SUBCOLLECTION)
            .where('isActive', '==', true).limit(1).get()
          return depSnap.empty ? null : trip
        })
      )
      trips = withDeps.filter((t): t is NonNullable<typeof t> => t !== null)
    }

    const total = trips.length

    // Cursor-based pagination
    const cursorIndex = cursor ? trips.findIndex((t) => t.id === cursor) : -1
    if (cursor && cursorIndex === -1) {
      return NextResponse.json(
        { code: 'INVALID_CURSOR', message: 'Cursor de paginacion invalido', retryable: false },
        { status: 400 }
      )
    }
    const startIndex = cursorIndex + 1
    const page = trips.slice(startIndex, startIndex + pageSize)
    const nextCursor = startIndex + pageSize < total ? page[page.length - 1]?.id ?? null : null

    return NextResponse.json({ trips: page, nextCursor, total })
  } catch (error) {
    return handleApiError(error)
  }
}
