import 'server-only'
import { adminDb } from '@/lib/firebase/admin'
import type { PublicTrip } from '@/types/trip'

const TRIPS_COLLECTION = 'trips'

/** Fields needed for PublicTrip — excludes heavy fields like odooImageBase64 */
const PUBLIC_TRIP_FIELDS = [
  'odooName',
  'odooListPriceCentavos',
  'odooCurrencyCode',
  'odooCategory',
  'odooDescriptionSale',
  'slug',
  'emotionalCopy',
  'tags',
  'highlights',
  'difficulty',
  'seoTitle',
  'seoDescription',
  'heroImages',
  'isPublished',
  'nextDepartureDate',
  'totalDepartures',
  'totalSeatsAvailable',
  'totalSeatsMax',
] as const

/**
 * Get all published trips for the public catalog.
 * Server-only — reads Firestore directly with Admin SDK for SSG/ISR.
 * Uses select() to exclude heavy fields (odooImageBase64).
 */
export async function getPublishedTrips(): Promise<PublicTrip[]> {
  const snapshot = await adminDb
    .collection(TRIPS_COLLECTION)
    .where('isPublished', '==', true)
    .orderBy('odooName')
    .select(...PUBLIC_TRIP_FIELDS)
    .get()

  return snapshot.docs.map((doc) => mapDocToPublicTrip(doc.id, doc.data()))
}

/**
 * Get a single published trip by slug.
 * Returns null if not found or not published.
 */
export async function getPublishedTripBySlug(slug: string): Promise<PublicTrip | null> {
  const snapshot = await adminDb
    .collection(TRIPS_COLLECTION)
    .where('slug', '==', slug)
    .where('isPublished', '==', true)
    .limit(1)
    .select(...PUBLIC_TRIP_FIELDS)
    .get()

  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return mapDocToPublicTrip(doc.id, doc.data())
}

function mapDocToPublicTrip(id: string, data: FirebaseFirestore.DocumentData): PublicTrip {
  let nextDepartureDate: string | null = null
  const nextDep = data.nextDepartureDate
  if (nextDep) {
    const secs = nextDep._seconds ?? nextDep.seconds ?? 0
    if (secs > 0) {
      nextDepartureDate = new Date(secs * 1000).toISOString()
    }
  }

  return {
    id,
    odooName: data.odooName ?? '',
    odooListPriceCentavos: data.odooListPriceCentavos ?? 0,
    odooCurrencyCode: data.odooCurrencyCode ?? 'MXN',
    odooCategory: data.odooCategory ?? '',
    odooDescriptionSale: data.odooDescriptionSale ?? '',
    slug: data.slug ?? '',
    emotionalCopy: data.emotionalCopy ?? '',
    tags: data.tags ?? [],
    highlights: data.highlights ?? [],
    difficulty: data.difficulty ?? null,
    seoTitle: data.seoTitle ?? '',
    seoDescription: data.seoDescription ?? '',
    heroImages: data.heroImages ?? [],
    isPublished: true,
    nextDepartureDate,
    totalDepartures: data.totalDepartures ?? 0,
    totalSeatsAvailable: data.totalSeatsAvailable ?? 0,
    totalSeatsMax: data.totalSeatsMax ?? 0,
  }
}
