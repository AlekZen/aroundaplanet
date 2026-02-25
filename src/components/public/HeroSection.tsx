'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { fadeIn, slideUp } from '@/lib/animations/variants'
import { tween } from '@/lib/animations/transitions'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface HeroSectionProps {
  title?: string
  subtitle?: string
  ctaLabel?: string
  ctaHref?: string
  imageSrc?: string
  imageAlt?: string
  className?: string
}

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
}

export function HeroSection({
  title = 'Camina con Nosotros',
  subtitle = 'Vuelta al Mundo en 33.8 dias — Tu aventura comienza hoy',
  ctaLabel = 'Explorar Viajes',
  ctaHref = '/viajes',
  imageSrc = '/images/hero/hero-group-photo-01.webp',
  imageAlt = 'Grupo de viajeros AroundaPlanet',
  className,
}: HeroSectionProps) {
  const containerVariants = useReducedMotion(CONTAINER_VARIANTS)
  const headingVariants = useReducedMotion(slideUp)
  const subtitleVariants = useReducedMotion(fadeIn)

  return (
    <section
      className={cn(
        'relative flex min-h-[60vh] items-center justify-center overflow-hidden rounded-xl lg:min-h-[70vh]',
        className
      )}
    >
      {/* Background image */}
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-primary/60" />

      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 px-4 text-center"
      >
        <motion.h1
          variants={headingVariants}
          transition={tween}
          className="font-heading text-4xl font-bold text-white md:text-5xl lg:text-6xl"
        >
          {title}
        </motion.h1>

        <motion.p
          variants={subtitleVariants}
          transition={tween}
          className="mx-auto mt-4 max-w-2xl text-lg text-white/90 md:text-xl"
        >
          {subtitle}
        </motion.p>

        <motion.div variants={subtitleVariants} transition={tween} className="mt-8">
          <Button
            asChild
            size="lg"
            className="min-h-12 bg-accent px-8 text-lg font-semibold text-accent-foreground shadow-lg hover:bg-accent-light"
          >
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  )
}
