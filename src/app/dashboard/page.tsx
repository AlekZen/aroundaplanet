'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/useAuthStore'
import { ROLE_DASHBOARDS, ROLE_PRIORITY, DEFAULT_ROLE } from '@/config/roles'
import type { UserRole } from '@/types/user'

function getHighestRole(roles: UserRole[]): UserRole {
  if (roles.length === 0) return DEFAULT_ROLE
  return roles.reduce((highest, role) =>
    (ROLE_PRIORITY[role] ?? 0) > (ROLE_PRIORITY[highest] ?? 0) ? role : highest
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { isLoading, isAuthenticated, claims, profile } = useAuthStore()

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      router.replace('/login')
      return
    }

    const roles = claims?.roles ?? profile?.roles ?? [DEFAULT_ROLE]
    const highestRole = getHighestRole(roles)
    const target = ROLE_DASHBOARDS[highestRole]
    router.replace(target)
  }, [isLoading, isAuthenticated, claims, profile, router])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md space-y-4 p-8">
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}
