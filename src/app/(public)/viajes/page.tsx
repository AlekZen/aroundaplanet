import { Suspense } from 'react'
import { createMetadata } from '@/lib/metadata'
import { getPublishedTrips } from '@/lib/firebase/trips-public'
import { CatalogContent } from './CatalogContent'
import { CatalogSkeleton } from './CatalogSkeleton'
import type { PublicTrip } from '@/types/trip'

export const revalidate = 3600

export const metadata = createMetadata({
  title: 'Viajes — AroundaPlanet',
  description:
    'Explora nuestro catalogo de viajes grupales: Vuelta al Mundo, Europa, Asia, Sudamerica y mas. Grupos pequenos, experiencias unicas.',
})

export default async function CatalogPage() {
  let trips: PublicTrip[] = []
  try {
    trips = await getPublishedTrips()
  } catch (error) {
    console.error('[CatalogPage] Error fetching trips from Firestore:', error)
  }

  return (
    <div className="space-y-8 py-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
          Explora Nuestros Viajes
        </h1>
        <p className="text-lg text-muted-foreground">
          Descubre destinos increibles con grupos pequenos y experiencias autenticas.
        </p>
      </div>

      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogContent trips={trips} />
      </Suspense>
    </div>
  )
}
