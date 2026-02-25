'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { staggerChildren } from '@/lib/animations/variants'
import { spring } from '@/lib/animations/transitions'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { LayoutDashboard, Users, CreditCard, Settings, BarChart3, Bell, Shield } from 'lucide-react'

interface RoleSidebarProps {
  roles: string[]
  className?: string
}

const SECTIONS_BY_ROLE: Record<string, Array<{ id: string; label: string; icon: React.ReactNode; href: string }>> = {
  admin: [
    { id: 'verification', label: 'Verificacion', icon: <CreditCard className="h-5 w-5" />, href: '/admin/verification' },
    { id: 'agents', label: 'Agentes', icon: <Users className="h-5 w-5" />, href: '/admin/agents' },
    { id: 'clients', label: 'Clientes', icon: <Users className="h-5 w-5" />, href: '/admin/clients' },
    { id: 'trips', label: 'Viajes', icon: <LayoutDashboard className="h-5 w-5" />, href: '/admin/trips' },
  ],
  director: [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="h-5 w-5" />, href: '/director/dashboard' },
    { id: 'agents', label: 'Agentes', icon: <Users className="h-5 w-5" />, href: '/director/agents' },
    { id: 'alerts', label: 'Alertas', icon: <Bell className="h-5 w-5" />, href: '/director/alerts' },
  ],
  agente: [
    { id: 'dashboard', label: 'Mi Negocio', icon: <LayoutDashboard className="h-5 w-5" />, href: '/agent/dashboard' },
    { id: 'clients', label: 'Clientes', icon: <Users className="h-5 w-5" />, href: '/agent/clients' },
    { id: 'payments', label: 'Pagos', icon: <CreditCard className="h-5 w-5" />, href: '/agent/payments' },
  ],
  superadmin: [
    { id: 'users', label: 'Usuarios', icon: <Shield className="h-5 w-5" />, href: '/superadmin/users' },
    { id: 'config', label: 'Configuracion', icon: <Settings className="h-5 w-5" />, href: '/superadmin/config' },
    { id: 'odoo-sync', label: 'Sync Odoo', icon: <LayoutDashboard className="h-5 w-5" />, href: '/superadmin/odoo-sync' },
  ],
}

export function RoleSidebar({ roles, className }: RoleSidebarProps) {
  const pathname = usePathname()
  const sections = roles.flatMap((role) => SECTIONS_BY_ROLE[role] ?? [])
  const variants = useReducedMotion(staggerChildren)

  return (
    <Sidebar collapsible="icon" className={cn('bg-primary text-primary-foreground', className)}>
      <SidebarHeader className="border-b border-primary-foreground/20">
        <div className="flex items-center gap-3 px-2">
          <Image src="/images/logo-aroundaplanet.webp" alt="AroundaPlanet" width={32} height={32} className="h-8 w-8" />
          <span className="font-heading text-sm font-semibold group-data-[collapsible=icon]:hidden">AroundaPlanet</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <motion.div variants={variants} initial="hidden" animate="visible" transition={spring}>
              <SidebarMenu>
                {sections.map((section) => {
                  const isActive = pathname === section.href || pathname?.startsWith(section.href + '/')
                  return (
                    <SidebarMenuItem key={section.id}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={section.label}>
                        <Link href={section.href}>
                          {section.icon}
                          <span>{section.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </motion.div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-primary-foreground/20 p-2">
        <span className="text-xs text-primary-foreground/50 group-data-[collapsible=icon]:hidden">AroundaPlanet v1.0</span>
      </SidebarFooter>
    </Sidebar>
  )
}
