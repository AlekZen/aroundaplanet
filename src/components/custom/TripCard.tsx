'use client'
import Image from 'next/image'
import Link from 'next/link'
import { cn, formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion, useReducedMotion as useFramerReducedMotion } from 'framer-motion'
import { spring } from '@/lib/animations/transitions'

const TRIP_PLACEHOLDER_IMAGE = '/images/trips/placeholder.svg'

interface TripCardProps {
  trip: { title: string; slug: string; imageUrl: string; price: number; dates: string; destination: string }
  variant?: 'public' | 'agent' | 'client' | 'compact'
  isSoldOut?: boolean
  href?: string
  onClick?: () => void
  className?: string
}

const CTA_LABELS = { public: 'Cotizar', agent: 'Copiar Link', client: 'Ver Progreso', compact: 'Ver' } as const

const HOVER_ANIM = { y: -4 }
const TAP_ANIM = { scale: 0.98 }

export function TripCard({ trip, variant = 'public', isSoldOut = false, href, onClick, className }: TripCardProps) {
  const prefersReduced = useFramerReducedMotion()
  const effectiveHref = isSoldOut ? undefined : href
  const effectiveOnClick = isSoldOut ? undefined : onClick

  const cardContent = (
    <Card
      className={cn(
        'overflow-hidden',
        effectiveHref || effectiveOnClick ? 'cursor-pointer' : '',
        isSoldOut && 'opacity-75',
        className,
      )}
      onClick={effectiveOnClick}
      role="article"
      aria-label={`${trip.title}${isSoldOut ? ' — Agotado' : ''}`}
    >
      <div className="relative aspect-video">
        <Image
          src={trip.imageUrl || TRIP_PLACEHOLDER_IMAGE}
          alt={trip.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {isSoldOut ? (
          <Badge className="absolute top-2 right-2 bg-destructive text-destructive-foreground">Agotado</Badge>
        ) : (
          <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">{trip.destination}</Badge>
        )}
      </div>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-heading text-lg font-semibold text-foreground line-clamp-1">{trip.title}</h3>
        <p className="text-sm text-muted-foreground">{trip.dates}</p>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xl font-medium text-foreground">{formatCurrency(trip.price)}</span>
          {effectiveHref ? (
            <span
              className={cn(
                'inline-flex h-9 min-h-11 items-center justify-center rounded-md px-3 text-sm font-medium',
                isSoldOut
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-accent text-accent-foreground hover:bg-accent-light',
              )}
            >
              {isSoldOut ? 'Agotado' : CTA_LABELS[variant]}
            </span>
          ) : (
            <Button
              size="sm"
              disabled={isSoldOut}
              className={cn(
                'min-h-11',
                isSoldOut
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-accent text-accent-foreground hover:bg-accent-light',
              )}
              onClick={(e) => { e.stopPropagation(); effectiveOnClick?.() }}
            >
              {isSoldOut ? 'Agotado' : CTA_LABELS[variant]}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const wrapped = effectiveHref ? <Link href={effectiveHref} className="block">{cardContent}</Link> : cardContent

  if (prefersReduced) {
    return <div>{wrapped}</div>
  }

  return (
    <motion.div whileHover={isSoldOut ? undefined : HOVER_ANIM} whileTap={isSoldOut ? undefined : TAP_ANIM} transition={spring}>
      {wrapped}
    </motion.div>
  )
}

export function TripCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="aspect-video bg-muted animate-pulse" />
      <div className="p-4 space-y-2">
        <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
        <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
        <div className="flex items-center justify-between">
          <div className="h-6 w-24 bg-muted animate-pulse rounded" />
          <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
        </div>
      </div>
    </div>
  )
}
