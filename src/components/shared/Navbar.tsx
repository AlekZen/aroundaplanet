'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/viajes', label: 'Viajes' },
  { href: '/viajes/vuelta-al-mundo', label: 'Vuelta al Mundo' },
  { href: '/sobre-nosotros', label: 'Nosotros' },
]

interface NavbarProps {
  className?: string
}

export function Navbar({ className }: NavbarProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border',
        className
      )}
    >
      <nav
        role="navigation"
        aria-label="Navegacion principal"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 min-h-11 min-w-11">
          <Image
            src="/images/logo-aroundaplanet.webp"
            alt="AroundaPlanet"
            width={40}
            height={40}
            className="h-10 w-10"
          />
          <span className="font-heading text-lg font-semibold text-primary hidden sm:inline">
            AroundaPlanet
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-6">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'text-sm font-medium transition-colors min-h-11 flex items-center focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
                  isActive
                    ? 'text-primary border-b-2 border-accent'
                    : 'text-foreground/80 hover:text-primary'
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-3">
          <Button variant="outline" size="sm" asChild className="min-h-11">
            <Link href="/login">Iniciar Sesion</Link>
          </Button>
          <Button size="sm" asChild className="min-h-11 bg-accent text-accent-foreground hover:bg-accent-light">
            <Link href="/viajes">Cotizar</Link>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Abrir menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetTitle className="font-heading text-primary">Menu</SheetTitle>
            <nav className="flex flex-col gap-4 mt-8" aria-label="Menu movil">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'text-lg font-medium transition-colors min-h-11 flex items-center focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
                      isActive
                        ? 'text-primary font-bold'
                        : 'text-foreground hover:text-primary'
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
              <Separator className="my-2" />
              <Button variant="outline" asChild className="min-h-11">
                <Link href="/login" onClick={() => setOpen(false)}>Iniciar Sesion</Link>
              </Button>
              <Button asChild className="min-h-11 bg-accent text-accent-foreground hover:bg-accent-light">
                <Link href="/viajes" onClick={() => setOpen(false)}>Cotizar</Link>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}
