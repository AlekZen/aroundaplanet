import { STATIC_TRIPS } from '@/lib/data/trips'
import { createMetadata } from '@/lib/metadata'
import { TripCard } from '@/components/custom/TripCard'
import { HeroSection } from '@/components/public/HeroSection'
import { AboutSection } from '@/components/public/AboutSection'
import { CTASection } from '@/components/public/CTASection'

export const metadata = createMetadata({
  title: 'AroundaPlanet — Viaja el Mundo',
  description:
    'Vuelta al Mundo en 33.8 dias. La agencia de viajes grupales mas aventurera de Mexico. Mas de 8 anios de experiencia, +100 agentes.',
})

export default function HomePage() {
  return (
    <div className="space-y-16 pb-8">
      {/* Hero — full width inside max-w-7xl container */}
      <HeroSection />

      {/* Trip grid */}
      <section className="space-y-6">
        <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Nuestros Destinos
        </h2>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 list-none p-0">
          {STATIC_TRIPS.map((trip) => (
            <li key={trip.slug}>
              <TripCard trip={trip} variant="public" href={`/viajes/${trip.slug}`} />
            </li>
          ))}
        </ul>
      </section>

      {/* About */}
      <AboutSection />

      {/* CTA */}
      <CTASection
        title="Tu proxima aventura te espera"
        description="Mas de 8 anios llevando grupos por el mundo. Unete a la comunidad de viajeros AroundaPlanet."
        ctaLabel="Cotizar mi Viaje"
        ctaHref="/viajes/vuelta-al-mundo-2025"
      />
    </div>
  )
}
