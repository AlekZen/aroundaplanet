import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { fetchTripsFromOdoo, fetchDeparturesFromOdoo, fetchOdooDocuments } from '@/lib/odoo/models/trips'
import { tripDocId, departureDocId } from '@/schemas/tripSchema'
import type { Trip, TripSyncOptions, TripSyncResult } from '@/types/trip'

const TRIPS_COLLECTION = 'trips'
const DEPARTURES_SUBCOLLECTION = 'departures'
const AUDIT_COLLECTION = 'auditLog'

/** Default editorial fields for new trip documents */
const DEFAULT_EDITORIAL_FIELDS: Pick<Trip,
  'heroImages' | 'slug' | 'emotionalCopy' | 'tags' | 'highlights' |
  'difficulty' | 'seoTitle' | 'seoDescription' | 'documents' | 'odooDocuments' |
  'nextDepartureDate' | 'nextDepartureEndDate' | 'totalDepartures' | 'totalSeatsMax' | 'totalSeatsAvailable'
> = {
  heroImages: [],
  slug: '',
  emotionalCopy: '',
  tags: [],
  highlights: [],
  difficulty: null,
  seoTitle: '',
  seoDescription: '',
  documents: [],
  odooDocuments: [],
  nextDepartureDate: null,
  nextDepartureEndDate: null,
  totalDepartures: 0,
  totalSeatsMax: 0,
  totalSeatsAvailable: 0,
}

/**
 * Sync trips from Odoo to Firestore.
 *
 * - Full mode: fetches all matching products, creates/updates in Firestore
 * - Incremental mode: only processes products with write_date > lastSyncAt
 * - NEVER overwrites editorial fields (heroImages, slug, emotionalCopy, etc.)
 * - Soft delete: marks isActive=false for products no longer in Odoo results
 */
export async function syncTrips(
  options: TripSyncOptions,
  performedBy: string,
): Promise<TripSyncResult> {
  const syncStartedAt = new Date()
  let created = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  // Step 1: Fetch trips from Odoo
  const { trips: odooTrips, total, errors: fetchErrors } = await fetchTripsFromOdoo(options)
  errors += fetchErrors.length

  // Step 2: Get existing Odoo-synced trip docs from Firestore for comparison
  // Only fetch docs that have odooProductId (excludes manually-created trips)
  const tripsRef = adminDb.collection(TRIPS_COLLECTION)
  const existingSnapshot = await tripsRef.where('odooProductId', '!=', null).get()
  const existingDocs = new Map<number, FirebaseFirestore.DocumentSnapshot>()
  for (const doc of existingSnapshot.docs) {
    const data = doc.data()
    if (data?.odooProductId) {
      existingDocs.set(data.odooProductId as number, doc)
    }
  }

  // Track which Odoo IDs we processed (for soft delete)
  const processedOdooIds = new Set<number>()

  // Step 3: Upsert each trip
  const now = Timestamp.now()

  for (const tripFields of odooTrips) {
    try {
      processedOdooIds.add(tripFields.odooProductId)
      const docId = tripDocId(tripFields.odooProductId)
      const docRef = tripsRef.doc(docId)
      const existingDoc = existingDocs.get(tripFields.odooProductId)

      if (existingDoc?.exists) {
        // Incremental check: skip if not changed
        if (options.mode === 'incremental') {
          const existingData = existingDoc.data()
          const existingWriteDate = existingData?.odooWriteDate as Timestamp | undefined
          if (existingWriteDate && tripFields.odooWriteDate) {
            const existingMs = existingWriteDate.toMillis()
            const newMs = tripFields.odooWriteDate.toMillis()
            if (newMs <= existingMs) {
              skipped++
              continue
            }
          }
        }

        // Update: only odoo* fields + sync metadata + status flags
        // NEVER touch editorial fields
        await docRef.set({
          ...tripFields,
          syncSource: options.mode === 'incremental' ? 'scheduled' as const : 'manual' as const,
          updatedAt: now,
        }, { merge: true })
        updated++
      } else {
        // Create: odoo fields + default editorial fields + timestamps
        await docRef.set({
          ...tripFields,
          ...DEFAULT_EDITORIAL_FIELDS,
          syncSource: 'manual' as const,
          createdAt: now,
          updatedAt: now,
        })
        created++
      }
    } catch (err) {
      console.error(`[trip-sync] Error syncing product ${tripFields.odooProductId}:`, err)
      errors++
    }
  }

  // Step 4: Soft delete — mark trips that are no longer in Odoo results
  // Only in full mode (incremental mode doesn't have the complete list)
  if (options.mode === 'full') {
    for (const [odooId, doc] of existingDocs) {
      if (!processedOdooIds.has(odooId)) {
        try {
          const data = doc.data()
          if (data?.isActive !== false) {
            await doc.ref.set({
              isActive: false,
              syncStatus: 'success',
              lastSyncAt: now,
              updatedAt: now,
            }, { merge: true })
            updated++
          }
        } catch (err) {
          console.error(`[trip-sync] Error soft-deleting product ${odooId}:`, err)
          errors++
        }
      }
    }
  }

  // Step 5: Sync departures (if any events exist in Odoo)
  const odooProductIds = odooTrips.map(t => t.odooProductId)
  if (odooProductIds.length > 0) {
    try {
      const { departures, errors: depErrors } = await fetchDeparturesFromOdoo(odooProductIds)
      errors += depErrors.length

      for (const [productId, departureList] of departures) {
        const tripDocRef = tripsRef.doc(tripDocId(productId))
        const depCollRef = tripDocRef.collection(DEPARTURES_SUBCOLLECTION)

        for (const dep of departureList) {
          try {
            if (dep.odooEventId === null) continue
            const depDocRef = depCollRef.doc(departureDocId(dep.odooEventId))
            const depExists = (await depDocRef.get()).exists
            await depDocRef.set({
              ...dep,
              ...(depExists ? {} : { createdAt: now }),
              updatedAt: now,
            }, { merge: true })
          } catch (err) {
            console.error(`[trip-sync] Error syncing departure ${dep.odooEventId}:`, err)
            errors++
          }
        }
      }
    } catch (err) {
      console.error('[trip-sync] Error fetching departures:', err)
      // Non-fatal: trips are still synced even if departures fail
    }
  }

  // Step 5b: Compute departure aggregates and write to parent trip docs
  // These are denormalized from Odoo source-of-truth data we just synced
  if (odooProductIds.length > 0) {
    for (const productId of odooProductIds) {
      try {
        const tripDocRef = tripsRef.doc(tripDocId(productId))
        const depSnap = await tripDocRef.collection(DEPARTURES_SUBCOLLECTION)
          .where('isActive', '==', true)
          .orderBy('startDate', 'asc')
          .get()

        const activeDeps = depSnap.docs.map((d) => d.data())
        const futureDeps = activeDeps.filter((d) => {
          const ts = d.startDate as Timestamp | undefined
          return ts && ts.toMillis() > Date.now()
        })

        const nextDep = futureDeps[0] ?? null
        const totalDepartures = activeDeps.length
        const totalSeatsMax = futureDeps.reduce((sum, d) => sum + ((d.seatsMax as number) ?? 0), 0)
        const totalSeatsAvailable = futureDeps.reduce((sum, d) => sum + ((d.seatsAvailable as number) ?? 0), 0)

        await tripDocRef.set({
          nextDepartureDate: nextDep?.startDate ?? null,
          nextDepartureEndDate: nextDep?.endDate ?? null,
          totalDepartures,
          totalSeatsMax,
          totalSeatsAvailable,
        }, { merge: true })
      } catch (err) {
        console.error(`[trip-sync] Error computing departure aggregates for product ${productId}:`, err)
        // Non-fatal: trip data is still valid without aggregates
      }
    }
  }

  // Step 6: Sync Odoo documents (PDFs, images attached to products)
  if (odooProductIds.length > 0) {
    try {
      const documentsByProduct = await fetchOdooDocuments(odooProductIds)
      for (const [productId, docs] of documentsByProduct) {
        try {
          const tripDocRef = tripsRef.doc(tripDocId(productId))
          await tripDocRef.set({ odooDocuments: docs }, { merge: true })
        } catch (err) {
          console.error(`[trip-sync] Error syncing documents for product ${productId}:`, err)
          // Non-fatal per product
        }
      }
    } catch (err) {
      console.error('[trip-sync] Error fetching Odoo documents:', err)
      // Non-fatal: trips are still synced even if documents fail
    }
  }

  // Step 7: Audit log
  const syncedAt = syncStartedAt.toISOString()
  try {
    await adminDb.collection(AUDIT_COLLECTION).add({
      action: 'odoo.tripSyncCompleted',
      targetUid: 'system',
      performedBy,
      timestamp: now,
      details: {
        total,
        created,
        updated,
        skipped,
        errors,
        mode: options.mode,
        nameFilter: options.nameFilter ?? null,
        minPrice: options.minPrice ?? null,
      },
    })
  } catch (err) {
    console.error('[trip-sync] Error writing audit log:', err)
    // Non-fatal
  }

  return {
    total,
    created,
    updated,
    skipped,
    errors,
    syncedAt,
    syncSource: options.mode === 'incremental' ? 'scheduled' : 'manual',
  }
}
