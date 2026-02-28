import Image from 'next/image'
import { formatCurrency } from '@/lib/utils'
import type { PublicTrip } from '@/types/trip'

const TRIP_PLACEHOLDER_IMAGE = '/images/trips/placeholder.svg'

interface TripHeroProps {
  trip: PublicTrip
}

export function TripHero({ trip }: TripHeroProps) {
  const heroUrl = trip.heroImages[0] ?? TRIP_PLACEHOLDER_IMAGE
  const hasRealImage = trip.heroImages.length > 0

  return (
    <section
      className="relative flex min-h-[50vh] items-center justify-center overflow-hidden rounded-xl lg:min-h-[60vh]"
      aria-label={`${trip.odooName} — imagen principal`}
    >
      <Image
        src={heroUrl}
        alt={`${trip.odooName} — viaje AroundaPlanet`}
        fill
        priority
        className="object-cover"
        sizes="100vw"
        unoptimized={!hasRealImage}
      />
      <div className="absolute inset-0 bg-primary/50" />

      <div className="relative z-10 space-y-4 px-4 text-center">
        {trip.odooCategory && (
          <span className="inline-block rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
            {trip.odooCategory}
          </span>
        )}
        <h1 className="font-heading text-3xl font-bold text-white md:text-4xl lg:text-5xl">
          {trip.odooName}
        </h1>
        {trip.emotionalCopy && (
          <p className="text-lg text-white/90">{trip.emotionalCopy}</p>
        )}
        <p className="font-mono text-3xl font-medium text-white md:text-4xl">
          {formatCurrency(trip.odooListPriceCentavos)}
        </p>
      </div>
    </section>
  )
}
