'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { ROLE_DASHBOARDS, ROLE_LABELS, ROLE_COLORS, ROLE_PRIORITY } from '@/config/roles'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { UserRole } from '@/types/user'

/** Detect which role group the current path belongs to */
function detectCurrentRole(pathname: string): UserRole | null {
  if (pathname.startsWith('/superadmin')) return 'superadmin'
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/director')) return 'director'
  if (pathname.startsWith('/agent')) return 'agente'
  if (pathname.startsWith('/client')) return 'cliente'
  return null
}

export function RoleSwitcher() {
  const pathname = usePathname()
  const { claims, profile } = useAuthStore()
  const roles = (claims?.roles ?? profile?.roles ?? ['cliente']) as UserRole[]

  // Only show switcher if user has more than one role
  if (roles.length <= 1) return null

  const currentRole = detectCurrentRole(pathname)
  const sortedRoles = [...roles].sort((a, b) => (ROLE_PRIORITY[b] ?? 0) - (ROLE_PRIORITY[a] ?? 0))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${currentRole ? ROLE_COLORS[currentRole]?.bg ?? 'bg-gray-200' : 'bg-gray-200'}`}
            />
            {currentRole ? ROLE_LABELS[currentRole] : 'Cambiar rol'}
          </span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {sortedRoles.map((role) => {
          const isActive = role === currentRole
          return (
            <DropdownMenuItem key={role} asChild disabled={isActive}>
              <Link
                href={ROLE_DASHBOARDS[role]}
                className={isActive ? 'font-medium' : ''}
              >
                <span
                  className={`mr-2 inline-block h-2 w-2 rounded-full ${ROLE_COLORS[role]?.bg ?? 'bg-gray-200'}`}
                />
                {ROLE_LABELS[role]}
                {isActive && <span className="ml-auto text-[10px] text-muted-foreground">actual</span>}
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
