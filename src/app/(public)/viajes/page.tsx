import { STATIC_TRIPS } from '@/lib/data/trips'
import { createMetadata } from '@/lib/metadata'
import { TripCard } from '@/components/custom/TripCard'

export const metadata = createMetadata({
  title: 'Viajes — AroundaPlanet',
  description:
    'Explora nuestro catalogo de viajes grupales: Vuelta al Mundo, Europa, Asia, Sudamerica y mas. Grupos pequenos, experiencias unicas.',
})

export default function CatalogPage() {
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

      <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 list-none p-0">
        {STATIC_TRIPS.map((trip) => (
          <li key={trip.slug}>
            <TripCard trip={trip} variant="public" href={`/viajes/${trip.slug}`} />
          </li>
        ))}
      </ul>
    </div>
  )
}
