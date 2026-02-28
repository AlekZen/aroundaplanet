import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import type { PublicDeparture } from '@/types/trip'
import {
  getPublishedTrips,
  getPublishedTripBySlug,
  getDeparturesForTrip,
} from '@/lib/firebase/trips-public'
import { TripHero } from './TripHero'
import { TripInfo } from './TripInfo'
import { TripDescription } from './TripDescription'
import { TripTestimonials } from './TripTestimonials'
import { ConversionFlow } from './ConversionFlow'
import { TripAnalytics } from './TripAnalytics'

export const revalidate = 3600

interface TripPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  try {
    const trips = await getPublishedTrips()
    return trips.filter((trip) => trip.slug).map((trip) => ({ slug: trip.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: TripPageProps): Promise<Metadata> {
  const { slug } = await params
  try {
    const trip = await getPublishedTripBySlug(slug)
    if (!trip) return createMetadata()

    const title = trip.seoTitle || trip.odooName
    const description = (trip.seoDescription || trip.odooDescriptionSale || '')
      .replace(/<[^>]*>/g, '')
      .substring(0, 160)

    return createMetadata({
      title: `${title} — AroundaPlanet`,
      description,
      openGraph: trip.heroImages[0]
        ? { images: [{ url: trip.heroImages[0], width: 1200, height: 630 }] }
        : undefined,
    })
  } catch {
    return createMetadata()
  }
}

export default async function TripPage({ params }: TripPageProps) {
  const { slug } = await params

  let trip
  try {
    trip = await getPublishedTripBySlug(slug)
  } catch (error) {
    console.error('[TripPage] Error fetching trip:', error)
    notFound()
  }

  if (!trip) notFound()

  let departures: PublicDeparture[] = []
  try {
    departures = await getDeparturesForTrip(trip.id)
  } catch (error) {
    console.error('[TripPage] Error fetching departures:', error)
  }

  return (
    <div className="space-y-12 pb-20 lg:pb-8">
      <TripHero trip={trip} />
      <TripInfo trip={trip} />
      <TripDescription description={trip.odooDescriptionSale} />
      <ConversionFlow
        tripId={trip.id}
        tripName={trip.odooName}
        tripSlug={slug}
        tripPrice={trip.odooListPriceCentavos}
        departures={departures}
      />
      <TripTestimonials testimonials={[]} />
      <TripAnalytics trip={trip} />
    </div>
  )
}
