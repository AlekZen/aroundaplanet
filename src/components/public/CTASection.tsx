import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CTASectionProps {
  title?: string
  description?: string
  ctaLabel?: string
  ctaHref?: string
  variant?: 'primary' | 'muted'
  className?: string
}

export function CTASection({
  title = 'Tu proxima aventura te espera',
  description = 'Mas de 8 anios llevando grupos por el mundo. Unete a la comunidad de viajeros AroundaPlanet.',
  ctaLabel = 'Explorar Viajes',
  ctaHref = '/viajes',
  variant = 'primary',
  className,
}: CTASectionProps) {
  const isPrimary = variant === 'primary'

  return (
    <section
      className={cn(
        'rounded-xl px-6 py-16 text-center md:py-24',
        isPrimary ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        className
      )}
    >
      <h2
        className={cn(
          'font-heading text-2xl font-bold md:text-3xl lg:text-4xl',
          isPrimary ? 'text-primary-foreground' : 'text-foreground'
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          'mx-auto mt-4 max-w-xl text-base md:text-lg',
          isPrimary ? 'text-primary-foreground/80' : 'text-muted-foreground'
        )}
      >
        {description}
      </p>
      <div className="mt-8">
        <Button
          asChild
          size="lg"
          className={cn(
            'min-h-12 px-8 text-lg font-semibold shadow-lg',
            isPrimary
              ? 'bg-accent text-accent-foreground hover:bg-accent-light'
              : 'bg-primary text-primary-foreground hover:bg-primary-light'
          )}
        >
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </div>
    </section>
  )
}
