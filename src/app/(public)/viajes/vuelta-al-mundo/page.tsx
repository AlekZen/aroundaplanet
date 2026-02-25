import Image from 'next/image'
import Link from 'next/link'
import { createMetadata } from '@/lib/metadata'
import { formatCurrency } from '@/lib/utils'
import { STATIC_TRIPS, VUELTA_AL_MUNDO_ITINERARY } from '@/lib/data/trips'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CTASection } from '@/components/public/CTASection'

export const metadata = createMetadata({
  title: 'Vuelta al Mundo 33.8 dias — AroundaPlanet',
  description:
    'La aventura definitiva: 33.8 dias recorriendo los destinos mas impresionantes del planeta. Desde $145,000 MXN. Grupos pequenos.',
  openGraph: {
    images: [{ url: '/images/trips/vuelta-al-mundo-2025.webp', width: 1200, height: 630 }],
  },
})

export default function VueltaAlMundoPage() {
  return (
    <div className="space-y-12 pb-8">
      {/* Hero */}
      <section className="relative flex min-h-[50vh] items-center justify-center overflow-hidden rounded-xl lg:min-h-[60vh]">
        <Image
          src="/images/trips/vuelta-al-mundo-2025.webp"
          alt="Vuelta al Mundo 33.8 dias — grupo de viajeros"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-primary/50" />

        <div className="relative z-10 space-y-4 px-4 text-center">
          <Badge className="bg-accent text-accent-foreground">Producto Estrella</Badge>
          <h1 className="font-heading text-3xl font-bold text-white md:text-4xl lg:text-5xl">
            Vuelta al Mundo
          </h1>
          <p className="text-lg text-white/90">33.8 dias alrededor del planeta</p>
          <p className="font-mono text-3xl font-medium text-white md:text-4xl">
            {formatCurrency(STATIC_TRIPS[0].price)}
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

      {/* Itinerary */}
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

      {/* Pricing */}
      <section className="space-y-4 text-center">
        <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Inversion
        </h2>
        <p className="font-mono text-4xl font-medium text-foreground md:text-5xl">
          {formatCurrency(STATIC_TRIPS[0].price)}
        </p>
        <p className="text-base text-muted-foreground">
          Incluye vuelos internacionales, hospedaje, transportes terrestres y guia acompanante.
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
