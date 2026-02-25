'use client'

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { RoleSidebar } from '@/components/custom/RoleSidebar'
import { PageTransition } from '@/components/shared/PageTransition'

interface AdminShellProps {
  roles: string[]
  children: React.ReactNode
}

export function AdminShell({ roles, children }: AdminShellProps) {
  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:min-h-11 focus:flex focus:items-center focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        Saltar al contenido principal
      </a>
      <RoleSidebar roles={roles} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4 lg:hidden">
          <SidebarTrigger />
          <span className="font-heading text-sm font-semibold">AroundaPlanet</span>
        </header>
        <main id="main-content" className="flex-1 p-4 lg:p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
