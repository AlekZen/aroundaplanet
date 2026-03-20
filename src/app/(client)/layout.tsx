'use client'

import { ArrowLeft } from 'lucide-react'
import { PageTransition } from '@/components/shared/PageTransition'
import { RoleSwitcher } from '@/components/custom/RoleSwitcher'

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
            <button
              aria-label="Regresar"
              className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <RoleSwitcher />
          </nav>
        </header>
        <main id="main-content">
          <section aria-label="Estado de tu viaje" className="bg-primary/5 p-6">
            <div className="mt-4" aria-label="Progreso emocional">
              {/* EmotionalProgress placeholder — se reemplaza en Story 1.5+ */}
            </div>
          </section>
          <section
            aria-label="Contenido principal"
            className="max-w-3xl mx-auto p-4"
          >
            <PageTransition>{children}</PageTransition>
          </section>
        </main>
      </div>
    </>
  )
}
