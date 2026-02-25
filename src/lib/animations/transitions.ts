import type { Transition } from 'framer-motion'

/** Spring transition — natural, bouncy feel for interactive elements */
export const spring: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
}

/** Tween transition — smooth, predictable */
export const tween: Transition = {
  type: 'tween',
  ease: 'easeInOut',
}

/** Ease out expo — fast start, gentle stop. Premium feel. */
export const easeOutExpo: Transition = {
  type: 'tween',
  ease: [0.16, 1, 0.3, 1],
}

/** Duration presets */
export const duration = {
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
  page: 0.25,
} as const

/** Page transition config */
export const pageTransitionConfig: Transition = {
  type: 'tween' as const,
  ease: [0.25, 0.1, 0.25, 1],
  duration: 0.2,
}

/** Sidebar transition config — spring for interactive feel */
export const sidebarTransitionConfig: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
}

/** Stagger config for list items */
export const staggerConfig: Transition = {
  staggerChildren: 0.08,
  delayChildren: 0.1,
}
