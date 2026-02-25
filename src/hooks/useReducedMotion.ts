'use client'

import { useReducedMotion as useFramerReducedMotion } from 'framer-motion'
import { noMotion } from '@/lib/animations/variants'
import type { Variants } from 'framer-motion'

/**
 * Returns the provided variants if motion is allowed,
 * or empty (noMotion) variants if the user prefers reduced motion.
 */
export function useReducedMotion(variants: Variants): Variants {
  const prefersReducedMotion = useFramerReducedMotion()
  return prefersReducedMotion === true ? noMotion : variants
}
