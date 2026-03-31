import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { Testimonial } from '@/types/trip'

interface TripTestimonialsProps {
  testimonials: Testimonial[]
}

export function TripTestimonials({ testimonials }: TripTestimonialsProps) {
  if (testimonials.length === 0) {
    return (
      <section className="space-y-4" aria-label="Testimonios de viajeros">
        <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Experiencias de Viajeros
        </h2>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="text-5xl" aria-hidden="true">✈️</div>
            <p className="text-lg font-medium text-foreground">
              Se el primero en compartir tu experiencia
            </p>
            <p className="max-w-md text-muted-foreground">
              Este destino esta esperando tus historias. Viaja con nosotros
              y deja tu huella para futuros aventureros.
            </p>
            <Button asChild className="mt-2 bg-accent text-accent-foreground hover:bg-accent/90">
              <Link href="?cotizar=true" scroll={false}>Unirse a la Aventura</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-4" aria-label="Testimonios de viajeros">
      <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
        Experiencias de Viajeros
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {testimonials.map((t) => (
          <Card key={t.id}>
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                  aria-hidden="true"
                >
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-foreground">{t.name}</p>
                  <div className="flex gap-0.5" aria-label={`${t.rating} de 5 estrellas`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <span
                        key={i}
                        className={i < t.rating ? 'text-accent' : 'text-muted'}
                        aria-hidden="true"
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-muted-foreground">{t.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
