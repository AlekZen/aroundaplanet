import Image from 'next/image'
import { createMetadata } from '@/lib/metadata'
import { AboutSection } from '@/components/public/AboutSection'
import { CTASection } from '@/components/public/CTASection'

const COMPANY_STATS = [
  {
    title: '8+ Anios',
    description: 'Creando experiencias de viaje grupales desde 2018',
  },
  {
    title: '100+ Agentes',
    description: 'Red de agentes independientes en todo Mexico',
  },
  {
    title: 'Expansion Global',
    description: 'Abriendo operaciones en Madrid, Espana en 2026',
  },
] as const

export const metadata = createMetadata({
  title: 'Sobre Nosotros — AroundaPlanet',
  description:
    'Conoce a AroundaPlanet: mas de 8 anios creando viajes grupales unicos desde Ocotlan, Jalisco. +100 agentes, expansion a Madrid.',
})

export default function AboutPage() {
  return (
    <div className="space-y-12 py-8">
      {/* Hero image */}
      <section className="relative aspect-[21/9] overflow-hidden rounded-xl">
        <Image
          src="/images/hero/bg-group-original.webp"
          alt="Grupo de viajeros AroundaPlanet"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-primary/40" />
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="font-heading text-3xl font-bold text-white md:text-4xl lg:text-5xl">
            Sobre Nosotros
          </h1>
        </div>
      </section>

      {/* About content (reuses shared component) */}
      <AboutSection />

      {/* Extra details */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {COMPANY_STATS.map((stat) => (
          <div
            key={stat.title}
            className="rounded-lg border border-border bg-card p-6 text-center"
          >
            <p className="font-heading text-2xl font-bold text-primary">{stat.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{stat.description}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <CTASection
        title="Viaja con nosotros"
        description="Descubre por que miles de viajeros confian en AroundaPlanet para sus aventuras alrededor del mundo."
        ctaLabel="Ver Destinos"
        ctaHref="/viajes"
        variant="primary"
      />
    </div>
  )
}
