'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion as useFramerReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface BottomNavBarProps {
  tabs: Array<{ id: string; label: string; icon: React.ReactNode; href: string }>
  notificationBadges?: Record<string, number>
  className?: string
}

export function BottomNavBar({ tabs, notificationBadges, className }: BottomNavBarProps) {
  const pathname = usePathname()
  const prefersReduced = useFramerReducedMotion()
  return (
    <nav aria-label="Navegacion principal" className={cn('fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]', className)}>
      <div className="flex h-16 items-center justify-around">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname?.startsWith(tab.href + '/')
          const badge = notificationBadges?.[tab.id]
          return (
            <Link key={tab.id} href={tab.href} aria-current={isActive ? 'page' : undefined} className="relative flex min-h-14 min-w-14 flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2">
              <span className={cn('transition-colors', isActive ? 'text-accent' : 'text-muted-foreground')}>{tab.icon}</span>
              <span className={cn('transition-colors', isActive ? 'text-accent font-medium' : 'text-muted-foreground')}>{tab.label}</span>
              {isActive && (
                prefersReduced
                  ? <div className="absolute -bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />
                  : <motion.div layoutId="bottomnav-indicator" className="absolute -bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />
              )}
              {badge && badge > 0 && <span className="absolute -top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground px-1">{badge}</span>}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
