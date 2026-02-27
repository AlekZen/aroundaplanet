import { SidebarProvider } from '@/components/ui/sidebar'
import { BarChart3, Map, RefreshCw, UserCircle } from 'lucide-react'
import { RoleSidebar } from '@/components/custom/RoleSidebar'
import { BottomNavBar } from '@/components/custom/BottomNavBar'
import { PageTransition } from '@/components/shared/PageTransition'

const DIRECTOR_TABS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <BarChart3 className="h-5 w-5" />,
    href: '/director/dashboard',
  },
  {
    id: 'trips',
    label: 'Viajes',
    icon: <Map className="h-5 w-5" />,
    href: '/director/trips',
  },
  {
    id: 'odoo-sync',
    label: 'Sync',
    icon: <RefreshCw className="h-5 w-5" />,
    href: '/director/odoo-sync',
  },
  {
    id: 'profile',
    label: 'Perfil',
    icon: <UserCircle className="h-5 w-5" />,
    href: '/director/profile',
  },
]

export default function DirectorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:min-h-11 focus:flex focus:items-center focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        Saltar al contenido principal
      </a>
      <RoleSidebar roles={['director']} className="hidden lg:block" />
      <div className="flex flex-1 flex-col">
        <main
          id="main-content"
          className="flex-1 overflow-y-auto pb-20 lg:pb-0"
        >
          <PageTransition>{children}</PageTransition>
        </main>
        <BottomNavBar className="lg:hidden" tabs={DIRECTOR_TABS} />
      </div>
    </SidebarProvider>
  )
}
