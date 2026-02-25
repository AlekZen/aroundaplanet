import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import { formatCurrency } from '@/lib/utils'
import { STATIC_TRIPS, VUELTA_AL_MUNDO_ITINERARY } from '@/lib/data/trips'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CTASection } from '@/components/public/CTASection'

interface TripPageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return STATIC_TRIPS.map((trip) => ({ slug: trip.slug }))
}

export async function generateMetadata({ params }: TripPageProps): Promise<Metadata> {
  const { slug } = await params
  const trip = STATIC_TRIPS.find((t) => t.slug === slug)
  if (!trip) return createMetadata()

  return createMetadata({
    title: `${trip.title} — AroundaPlanet`,
    description: trip.description,
    openGraph: {
      images: [{ url: trip.imageUrl, width: 1200, height: 630 }],
    },
  })
}

export default async function TripPage({ params }: TripPageProps) {
  const { slug } = await params
  const trip = STATIC_TRIPS.find((t) => t.slug === slug)

  if (!trip) notFound()

  const isVaM = slug === 'vuelta-al-mundo'

  return (
    <div className="space-y-12 pb-8">
      {/* Hero */}
      <section className="relative flex min-h-[50vh] items-center justify-center overflow-hidden rounded-xl lg:min-h-[60vh]">
        <Image
          src={trip.imageUrl}
          alt={`${trip.title} — AroundaPlanet`}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-primary/50" />

        <div className="relative z-10 space-y-4 px-4 text-center">
          {isVaM && (
            <Badge className="bg-accent text-accent-foreground">Producto Estrella</Badge>
          )}
          <h1 className="font-heading text-3xl font-bold text-white md:text-4xl lg:text-5xl">
            {trip.title}
          </h1>
          <p className="text-lg text-white/90">
            {isVaM ? '33.8 dias alrededor del planeta' : `${trip.destination} — ${trip.dates}`}
          </p>
          <p className="font-mono text-3xl font-medium text-white md:text-4xl">
            {formatCurrency(trip.price)}
          </p>
          <Button
            asChild
            size="lg"
            className="min-h-12 bg-accent px-8 text-lg font-semibold text-accent-foreground shadow-lg hover:bg-accent-light"
          >
            <Link href="/login">Cotizar Ahora</Link>
          </Button>
        </div>
      </section>

      {/* Description */}
      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Sobre este viaje
        </h2>
        <p className="text-base text-muted-foreground md:text-lg">
          {trip.description}
        </p>
      </section>

      {/* Itinerary — only for Vuelta al Mundo */}
      {isVaM && (
        <>
          <section className="space-y-6">
            <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
              Itinerario
            </h2>
            <div className="space-y-4">
              {VUELTA_AL_MUNDO_ITINERARY.map((item) => (
                <Card key={item.day} className="overflow-hidden">
                  <CardContent className="flex items-start gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {item.day}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-heading text-sm font-semibold text-foreground">
                          Dia {item.day}
                        </span>
                        <span className="text-sm text-muted-foreground">—</span>
                        <span className="text-sm font-medium text-primary">{item.location}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <Separator />
        </>
      )}

      {/* Pricing */}
      <section className="space-y-4 text-center">
        <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Inversion
        </h2>
        <p className="font-mono text-4xl font-medium text-foreground md:text-5xl">
          {formatCurrency(trip.price)}
        </p>
        <p className="text-base text-muted-foreground">
          {isVaM
            ? 'Incluye vuelos internacionales, hospedaje, transportes terrestres y guia acompanante.'
            : 'Incluye hospedaje, transportes y experiencias seleccionadas. Cotiza para detalles completos.'}
        </p>
        <p className="text-sm text-muted-foreground">
          Plan de pagos disponible — cotiza para conocer las opciones.
        </p>
      </section>

      {/* CTA */}
      <CTASection
        title="Reserva tu lugar"
        description="Los grupos son pequenos y los lugares se agotan rapido. No te quedes fuera de la aventura de tu vida."
        ctaLabel="Cotizar Ahora"
        ctaHref="/login"
        variant="muted"
      />
    </div>
  )
}
