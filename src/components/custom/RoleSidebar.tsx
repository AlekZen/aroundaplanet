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
import { RoleSwitcher } from '@/components/custom/RoleSwitcher'
import { cn } from '@/lib/utils'
import { staggerChildren } from '@/lib/animations/variants'
import { spring } from '@/lib/animations/transitions'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { LayoutDashboard, CreditCard, BarChart3, Shield, UserCircle, RefreshCw, Map, Users, Plane, Contact, UserCheck } from 'lucide-react'

interface RoleSidebarProps {
  roles: string[]
  className?: string
}

const SECTIONS_BY_ROLE: Record<string, Array<{ id: string; label: string; icon: React.ReactNode; href: string }>> = {
  admin: [
    { id: 'dashboard', label: 'Panel', icon: <LayoutDashboard className="h-5 w-5" />, href: '/admin/dashboard' },
    { id: 'leads', label: 'Leads', icon: <Users className="h-5 w-5" />, href: '/admin/leads' },
    { id: 'verification', label: 'Verificacion', icon: <CreditCard className="h-5 w-5" />, href: '/admin/verification' },
    { id: 'trips', label: 'Viajes', icon: <Map className="h-5 w-5" />, href: '/admin/trips' },
    { id: 'odoo-sync', label: 'Sync Odoo', icon: <RefreshCw className="h-5 w-5" />, href: '/admin/odoo-sync' },
    { id: 'admin-my-trips', label: 'Mis Viajes', icon: <Plane className="h-5 w-5" />, href: '/admin/my-trips' },
    { id: 'admin-profile', label: 'Mi Perfil', icon: <UserCircle className="h-5 w-5" />, href: '/admin/profile' },
  ],
  director: [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="h-5 w-5" />, href: '/director/dashboard' },
    { id: 'trips', label: 'Viajes', icon: <Map className="h-5 w-5" />, href: '/director/trips' },
    { id: 'odoo-sync', label: 'Sync Odoo', icon: <RefreshCw className="h-5 w-5" />, href: '/director/odoo-sync' },
    { id: 'director-my-trips', label: 'Mis Viajes', icon: <Plane className="h-5 w-5" />, href: '/director/my-trips' },
    { id: 'director-profile', label: 'Mi Perfil', icon: <UserCircle className="h-5 w-5" />, href: '/director/profile' },
  ],
  agente: [
    { id: 'dashboard', label: 'Mi Negocio', icon: <LayoutDashboard className="h-5 w-5" />, href: '/agent/dashboard' },
    { id: 'agent-clients', label: 'Mis Clientes', icon: <UserCheck className="h-5 w-5" />, href: '/agent/clients' },
    { id: 'agent-my-trips', label: 'Mis Viajes', icon: <Plane className="h-5 w-5" />, href: '/agent/my-trips' },
    { id: 'agent-profile', label: 'Mi Perfil', icon: <UserCircle className="h-5 w-5" />, href: '/agent/profile' },
  ],
  superadmin: [
    { id: 'users', label: 'Usuarios', icon: <Shield className="h-5 w-5" />, href: '/superadmin/users' },
    { id: 'agents', label: 'Agentes', icon: <Contact className="h-5 w-5" />, href: '/superadmin/agents' },
    { id: 'clients', label: 'Clientes', icon: <UserCheck className="h-5 w-5" />, href: '/superadmin/clients' },
    { id: 'leads', label: 'Leads', icon: <Users className="h-5 w-5" />, href: '/superadmin/leads' },
    { id: 'verification', label: 'Verificacion', icon: <CreditCard className="h-5 w-5" />, href: '/superadmin/verification' },
    { id: 'trips', label: 'Viajes', icon: <Map className="h-5 w-5" />, href: '/superadmin/trips' },
    { id: 'odoo-sync', label: 'Sync Odoo', icon: <RefreshCw className="h-5 w-5" />, href: '/superadmin/odoo-sync' },
    { id: 'superadmin-my-trips', label: 'Mis Viajes', icon: <Plane className="h-5 w-5" />, href: '/superadmin/my-trips' },
    { id: 'superadmin-profile', label: 'Mi Perfil', icon: <UserCircle className="h-5 w-5" />, href: '/superadmin/profile' },
  ],
}

export function RoleSidebar({ roles, className }: RoleSidebarProps) {
  const pathname = usePathname()
  const allSections = roles.flatMap((role) => SECTIONS_BY_ROLE[role] ?? [])
  const seen = new Set<string>()
  const sections = allSections.filter((s) => {
    if (seen.has(s.href)) return false
    seen.add(s.href)
    return true
  })
  const variants = useReducedMotion(staggerChildren)

  return (
    <Sidebar collapsible="icon" className={className}>
      <SidebarHeader className="border-b border-sidebar-border">
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
      <SidebarFooter className="border-t border-sidebar-border p-2 space-y-2">
        <div className="group-data-[collapsible=icon]:hidden">
          <RoleSwitcher />
        </div>
        <span className="text-xs text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">AroundaPlanet v1.0</span>
      </SidebarFooter>
    </Sidebar>
  )
}
