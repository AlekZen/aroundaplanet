'use client'
import Image from 'next/image'
import Link from 'next/link'
import { cn, formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion, useReducedMotion as useFramerReducedMotion } from 'framer-motion'
import { spring } from '@/lib/animations/transitions'

interface TripCardProps {
  trip: { title: string; slug: string; imageUrl: string; price: number; dates: string; destination: string }
  variant?: 'public' | 'agent' | 'client' | 'compact'
  href?: string
  onClick?: () => void
  className?: string
}

const CTA_LABELS = { public: 'Cotizar', agent: 'Copiar Link', client: 'Ver Progreso', compact: 'Ver' } as const

const HOVER_ANIM = { y: -4 }
const TAP_ANIM = { scale: 0.98 }

export function TripCard({ trip, variant = 'public', href, onClick, className }: TripCardProps) {
  const prefersReduced = useFramerReducedMotion()

  const cardContent = (
    <Card className={cn('overflow-hidden', href || onClick ? 'cursor-pointer' : '', className)} onClick={onClick} role="article" aria-label={trip.title}>
      <div className="relative aspect-video">
        <Image src={trip.imageUrl} alt={trip.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
        <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">{trip.destination}</Badge>
      </div>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-heading text-lg font-semibold text-foreground line-clamp-1">{trip.title}</h3>
        <p className="text-sm text-muted-foreground">{trip.dates}</p>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xl font-medium text-foreground">{formatCurrency(trip.price)}</span>
          {/* When href wraps the whole card, render a plain span styled as button
              to avoid nested <a> tags (invalid HTML → hydration mismatch). */}
          {href ? (
            <span className="inline-flex h-9 min-h-11 items-center justify-center rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent-light">
              {CTA_LABELS[variant]}
            </span>
          ) : (
            <Button
              size="sm"
              className="min-h-11 bg-accent text-accent-foreground hover:bg-accent-light"
              onClick={(e) => { e.stopPropagation(); onClick?.() }}
            >
              {CTA_LABELS[variant]}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const wrapped = href ? <Link href={href} className="block">{cardContent}</Link> : cardContent

  if (prefersReduced) {
    return <div>{wrapped}</div>
  }

  return (
    <motion.div whileHover={HOVER_ANIM} whileTap={TAP_ANIM} transition={spring}>
      {wrapped}
    </motion.div>
  )
}
