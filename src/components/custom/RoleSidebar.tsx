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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { RoleSwitcher } from '@/components/custom/RoleSwitcher'
import { staggerChildren } from '@/lib/animations/variants'
import { spring } from '@/lib/animations/transitions'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { LayoutDashboard, CreditCard, BarChart3, Shield, UserCircle, RefreshCw, Map as MapIcon, Users, Plane, Contact, UserCheck, DollarSign, FileText, Link2, Copy, ClipboardList, ShoppingCart, BookOpen } from 'lucide-react'

interface RoleSidebarProps {
  roles: string[]
  className?: string
}

type SidebarItem = { id: string; label: string; icon: React.ReactNode; href: string }
type SidebarGroupDef = { id: string; label: string; items: SidebarItem[] }

const GROUPS_BY_ROLE: Record<string, SidebarGroupDef[]> = {
  admin: [
    {
      id: 'general',
      label: 'General',
      items: [
        { id: 'dashboard', label: 'Panel', icon: <LayoutDashboard className="h-5 w-5" />, href: '/admin/dashboard' },
        { id: 'admin-my-trips', label: 'Mis Viajes', icon: <Plane className="h-5 w-5" />, href: '/admin/my-trips' },
        { id: 'admin-profile', label: 'Mi Perfil', icon: <UserCircle className="h-5 w-5" />, href: '/admin/profile' },
        { id: 'admin-manual', label: 'Ayuda y Manual', icon: <BookOpen className="h-5 w-5" />, href: '/admin/manual' },
      ],
    },
    {
      id: 'operacion',
      label: 'Operacion diaria',
      items: [
        { id: 'leads', label: 'Leads', icon: <Users className="h-5 w-5" />, href: '/admin/leads' },
        { id: 'quotations', label: 'Cotizaciones', icon: <ClipboardList className="h-5 w-5" />, href: '/admin/quotations' },
        { id: 'orders', label: 'Órdenes', icon: <ShoppingCart className="h-5 w-5" />, href: '/admin/orders' },
        { id: 'verification', label: 'Verificacion', icon: <CreditCard className="h-5 w-5" />, href: '/admin/verification' },
        { id: 'commissions', label: 'Comisiones', icon: <DollarSign className="h-5 w-5" />, href: '/admin/commissions' },
      ],
    },
    {
      id: 'sync-odoo',
      label: 'Sincronizacion con Odoo',
      items: [
        { id: 'reconciliation', label: 'Reconciliacion', icon: <Link2 className="h-5 w-5" />, href: '/admin/payments/reconciliation' },
        { id: 'sync-console', label: 'Consola de Sync', icon: <RefreshCw className="h-5 w-5" />, href: '/admin/payments/sync-console' },
        { id: 'duplicates', label: 'Duplicados Odoo', icon: <Copy className="h-5 w-5" />, href: '/admin/odoo/duplicates' },
        { id: 'odoo-sync', label: 'Sync Odoo', icon: <RefreshCw className="h-5 w-5" />, href: '/admin/odoo-sync' },
      ],
    },
    {
      id: 'catalogo',
      label: 'Catalogo',
      items: [
        { id: 'trips', label: 'Viajes', icon: <MapIcon className="h-5 w-5" />, href: '/admin/trips' },
        { id: 'documents', label: 'Documentos', icon: <FileText className="h-5 w-5" />, href: '/admin/documents' },
      ],
    },
  ],
  director: [
    {
      id: 'general',
      label: 'General',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="h-5 w-5" />, href: '/director/dashboard' },
        { id: 'director-my-trips', label: 'Mis Viajes', icon: <Plane className="h-5 w-5" />, href: '/director/my-trips' },
        { id: 'director-profile', label: 'Mi Perfil', icon: <UserCircle className="h-5 w-5" />, href: '/director/profile' },
      ],
    },
    {
      id: 'sync-odoo',
      label: 'Sincronizacion con Odoo',
      items: [
        { id: 'odoo-sync', label: 'Sync Odoo', icon: <RefreshCw className="h-5 w-5" />, href: '/director/odoo-sync' },
      ],
    },
    {
      id: 'catalogo',
      label: 'Catalogo',
      items: [
        { id: 'trips', label: 'Viajes', icon: <MapIcon className="h-5 w-5" />, href: '/director/trips' },
      ],
    },
  ],
  agente: [
    {
      id: 'general',
      label: 'General',
      items: [
        { id: 'dashboard', label: 'Mi Negocio', icon: <LayoutDashboard className="h-5 w-5" />, href: '/agent/dashboard' },
        { id: 'agent-clients', label: 'Mis Clientes', icon: <UserCheck className="h-5 w-5" />, href: '/agent/clients' },
        { id: 'agent-contracts', label: 'Contratos', icon: <ClipboardList className="h-5 w-5" />, href: '/agent/contracts' },
        { id: 'agent-my-trips', label: 'Mis Viajes', icon: <Plane className="h-5 w-5" />, href: '/agent/my-trips' },
        { id: 'agent-profile', label: 'Mi Perfil', icon: <UserCircle className="h-5 w-5" />, href: '/agent/profile' },
        { id: 'agent-manual', label: 'Ayuda y Manual', icon: <BookOpen className="h-5 w-5" />, href: '/agent/manual' },
      ],
    },
  ],
  superadmin: [
    {
      id: 'general',
      label: 'General',
      items: [
        { id: 'superadmin-my-trips', label: 'Mis Viajes', icon: <Plane className="h-5 w-5" />, href: '/superadmin/my-trips' },
        { id: 'superadmin-profile', label: 'Mi Perfil', icon: <UserCircle className="h-5 w-5" />, href: '/superadmin/profile' },
        { id: 'superadmin-manual', label: 'Ayuda y Manual', icon: <BookOpen className="h-5 w-5" />, href: '/admin/manual' },
      ],
    },
    {
      id: 'administracion',
      label: 'Administracion',
      items: [
        { id: 'users', label: 'Usuarios', icon: <Shield className="h-5 w-5" />, href: '/superadmin/users' },
        { id: 'agents', label: 'Agentes', icon: <Contact className="h-5 w-5" />, href: '/superadmin/agents' },
        { id: 'clients', label: 'Clientes', icon: <UserCheck className="h-5 w-5" />, href: '/superadmin/clients' },
      ],
    },
    {
      id: 'operacion',
      label: 'Operacion diaria',
      items: [
        { id: 'leads', label: 'Leads', icon: <Users className="h-5 w-5" />, href: '/superadmin/leads' },
        { id: 'quotations', label: 'Cotizaciones', icon: <ClipboardList className="h-5 w-5" />, href: '/admin/quotations' },
        { id: 'orders', label: 'Órdenes', icon: <ShoppingCart className="h-5 w-5" />, href: '/admin/orders' },
        { id: 'verification', label: 'Verificacion', icon: <CreditCard className="h-5 w-5" />, href: '/superadmin/verification' },
        { id: 'commissions', label: 'Comisiones', icon: <DollarSign className="h-5 w-5" />, href: '/superadmin/commissions' },
      ],
    },
    {
      id: 'sync-odoo',
      label: 'Sincronizacion con Odoo',
      items: [
        { id: 'reconciliation', label: 'Reconciliacion', icon: <Link2 className="h-5 w-5" />, href: '/admin/payments/reconciliation' },
        { id: 'sync-console', label: 'Consola de Sync', icon: <RefreshCw className="h-5 w-5" />, href: '/admin/payments/sync-console' },
        { id: 'duplicates', label: 'Duplicados Odoo', icon: <Copy className="h-5 w-5" />, href: '/admin/odoo/duplicates' },
        { id: 'odoo-sync', label: 'Sync Odoo', icon: <RefreshCw className="h-5 w-5" />, href: '/superadmin/odoo-sync' },
      ],
    },
    {
      id: 'catalogo',
      label: 'Catalogo',
      items: [
        { id: 'trips', label: 'Viajes', icon: <MapIcon className="h-5 w-5" />, href: '/superadmin/trips' },
        { id: 'documents', label: 'Documentos', icon: <FileText className="h-5 w-5" />, href: '/superadmin/documents' },
      ],
    },
  ],
}

export function RoleSidebar({ roles, className }: RoleSidebarProps) {
  const pathname = usePathname()

  const groupsMap = new Map<string, SidebarGroupDef>()
  const seenHrefs = new Set<string>()
  for (const role of roles) {
    const roleGroups = GROUPS_BY_ROLE[role] ?? []
    for (const group of roleGroups) {
      const items = group.items.filter((item) => {
        if (seenHrefs.has(item.href)) return false
        seenHrefs.add(item.href)
        return true
      })
      if (items.length === 0) continue
      const existing = groupsMap.get(group.id)
      if (existing) {
        existing.items = [...existing.items, ...items]
      } else {
        groupsMap.set(group.id, { id: group.id, label: group.label, items })
      }
    }
  }
  const groups = Array.from(groupsMap.values())
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
        <motion.div variants={variants} initial="hidden" animate="visible" transition={spring}>
          {groups.map((group) => (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                          <Link href={item.href}>
                            {item.icon}
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </motion.div>
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
