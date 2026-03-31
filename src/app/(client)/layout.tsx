'use client'

import { BottomNavBar } from '@/components/custom/BottomNavBar'
import { RoleSwitcher } from '@/components/custom/RoleSwitcher'
import { PageTransition } from '@/components/shared/PageTransition'
import { Plane, Globe, User } from 'lucide-react'

const CLIENT_TABS = [
  { id: 'my-trips', label: 'Mis Viajes', icon: <Plane className="h-5 w-5" />, href: '/client/my-trips' },
  { id: 'catalog', label: 'Explorar', icon: <Globe className="h-5 w-5" />, href: '/viajes' },
  { id: 'profile', label: 'Perfil', icon: <User className="h-5 w-5" />, href: '/client/profile' },
]

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:min-h-11 focus:flex focus:items-center focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        Saltar al contenido principal
      </a>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-card border-b border-border">
          <nav
            className="flex items-center justify-between px-4 h-14"
            aria-label="Navegacion de cliente"
          >
            <span className="font-heading text-sm font-semibold">AroundaPlanet</span>
            <RoleSwitcher />
          </nav>
        </header>
        <main id="main-content" className="p-4 pb-20 lg:pb-4">
          <section
            aria-label="Contenido principal"
            className="max-w-3xl mx-auto"
          >
            <PageTransition>{children}</PageTransition>
          </section>
        </main>
        <BottomNavBar tabs={CLIENT_TABS} />
      </div>
    </>
  )
}
