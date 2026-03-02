import { SidebarProvider } from '@/components/ui/sidebar'
import { RoleSidebar } from '@/components/custom/RoleSidebar'
import { BottomNavBar } from '@/components/custom/BottomNavBar'
import { PageTransition } from '@/components/shared/PageTransition'
import { LayoutDashboard, Globe, Users, User } from 'lucide-react'

const AGENT_TABS = [
  { id: 'dashboard', label: 'Mi Negocio', icon: <LayoutDashboard className="h-5 w-5" />, href: '/agent/dashboard' },
  { id: 'catalog', label: 'Catalogo', icon: <Globe className="h-5 w-5" />, href: '/agent/catalog' },
  { id: 'leads', label: 'Mis Leads', icon: <Users className="h-5 w-5" />, href: '/agent/leads' },
  { id: 'profile', label: 'Perfil', icon: <User className="h-5 w-5" />, href: '/agent/profile' },
]

export default function AgentMobileLayout({
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
      <RoleSidebar roles={['agente']} className="hidden lg:block" />
      <div className="flex flex-1 flex-col">
        <main id="main-content" className="flex-1 p-4 pb-20 lg:pb-4 lg:p-6">
          <PageTransition>{children}</PageTransition>
        </main>
        <BottomNavBar tabs={AGENT_TABS} className="lg:hidden" />
      </div>
    </SidebarProvider>
  )
}
