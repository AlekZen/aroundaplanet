import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AboutSectionProps {
  className?: string
}

export function AboutSection({ className }: AboutSectionProps) {
  return (
    <section className={cn('space-y-8', className)}>
      <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
        Sobre Nosotros
      </h2>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Group photo */}
        <div className="relative aspect-video overflow-hidden rounded-lg">
          <Image
            src="/images/about/about-group-photo.webp"
            alt="Equipo AroundaPlanet en viaje grupal"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>

        {/* Copy */}
        <div className="flex flex-col justify-center space-y-4">
          <p className="text-base text-muted-foreground md:text-lg">
            Desde Ocotlan, Jalisco, llevamos mas de{' '}
            <strong className="text-foreground">8 anios</strong> creando experiencias de viaje
            grupales unicas. Nuestro producto estrella, la{' '}
            <strong className="text-foreground">Vuelta al Mundo en 33.8 dias</strong>, ha llevado a
            cientos de viajeros a recorrer el planeta.
          </p>
          <p className="text-base text-muted-foreground md:text-lg">
            Con una red de mas de <strong className="text-foreground">100 agentes</strong> en
            Mexico y expansion a Madrid, AroundaPlanet es la comunidad de viajeros mas aventurera
            del pais.
          </p>

          {/* CEO */}
          <div className="flex items-center gap-4 pt-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full">
              <Image
                src="/images/about/noel-sahagun-ceo.webp"
                alt="Noel Sahagun, CEO de AroundaPlanet"
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
            <div>
              <p className="font-heading text-sm font-semibold text-foreground">Noel Sahagun</p>
              <p className="text-sm text-muted-foreground">Fundador y CEO</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
