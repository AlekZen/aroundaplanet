'use client'

import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { pageTransition } from '@/lib/animations/variants'
import { pageTransitionConfig } from '@/lib/animations/transitions'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const NOOP_SUBSCRIBE = () => () => {}

/** Returns true on client after hydration, false during SSR. */
function useHasHydrated() {
  return useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () => true, // client snapshot
    () => false // server snapshot
  )
}

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname()
  const variants = useReducedMotion(pageTransition)
  const hasHydrated = useHasHydrated()

  // During SSR + first hydration render, use a plain <div> to avoid
  // mismatch — framer-motion injects inline styles that don't exist
  // in server HTML. After hydration, enable motion for navigations.
  if (!hasHydrated) {
    return <div className={className}>{children}</div>
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={pageTransitionConfig}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
