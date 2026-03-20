import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'

const TRIPS_COLLECTION = 'trips'
const DEPARTURES_SUBCOLLECTION = 'departures'

/**
 * Recalculate trip aggregate fields from its active+published departures.
 * Updates: totalDepartures, nextDepartureDate, nextDepartureEndDate, totalSeatsMax, totalSeatsAvailable
 */
export async function recalculateTripAggregates(tripId: string): Promise<void> {
  const now = new Date()

  const snapshot = await adminDb
    .collection(TRIPS_COLLECTION)
    .doc(tripId)
    .collection(DEPARTURES_SUBCOLLECTION)
    .where('isActive', '==', true)
    .orderBy('startDate', 'asc')
    .get()

  const publishedDeps = snapshot.docs.filter((doc) => doc.data().isPublished === true)

  // Only count future departures for aggregates
  const futureDeps = publishedDeps.filter((doc) => {
    const startDate = doc.data().startDate
    if (!startDate) return false
    const secs = startDate._seconds ?? startDate.seconds ?? 0
    return new Date(secs * 1000) > now
  })

  let nextDepartureDate: Timestamp | null = null
  let nextDepartureEndDate: Timestamp | null = null
  let totalSeatsMax = 0
  let totalSeatsAvailable = 0

  for (const doc of futureDeps) {
    const data = doc.data()
    totalSeatsMax += data.seatsMax ?? 0
    totalSeatsAvailable += data.seatsAvailable ?? 0
  }

  if (futureDeps.length > 0) {
    const firstDep = futureDeps[0].data()
    nextDepartureDate = firstDep.startDate ?? null
    nextDepartureEndDate = firstDep.endDate ?? null
  }

  await adminDb.collection(TRIPS_COLLECTION).doc(tripId).update({
    totalDepartures: futureDeps.length,
    nextDepartureDate,
    nextDepartureEndDate,
    totalSeatsMax,
    totalSeatsAvailable,
  })
}
