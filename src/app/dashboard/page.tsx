'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { logout } from '@/lib/firebase/auth'
import { useAuthStore } from '@/stores/useAuthStore'

export default function DashboardPage() {
  const router = useRouter()
  const { isLoading, isAuthenticated, profile } = useAuthStore()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
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

  if (!isAuthenticated) {
    return null
  }

  async function handleLogout() {
    await logout()
    router.push('/')
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-card p-8 shadow-lg text-center">
        <h1 className="font-heading text-2xl font-bold text-primary">
          Bienvenido{profile?.displayName ? `, ${profile.displayName}` : ''}
        </h1>
        {profile?.email && (
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Tu panel personalizado estara disponible pronto.
        </p>
        <Button
          onClick={handleLogout}
          variant="outline"
          className="min-h-11"
        >
          Cerrar Sesion
        </Button>
      </div>
    </div>
  )
}
