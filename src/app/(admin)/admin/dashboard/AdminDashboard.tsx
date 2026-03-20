'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CreditCard, Map, RefreshCw, Users, ArrowRight, AlertTriangle,
  Globe, ShoppingCart, Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface DashboardStats {
  totalTrips: number
  publishedTrips: number
  totalOrders: number
  unassignedOrders: number
  pendingPayments: number
  lastSyncAt: string | null
}

function KpiSkeleton() {
  return (
    <Card className="p-4">
      <CardContent className="space-y-2 p-0">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  )
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'hace un momento'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/admin/stats')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `Error ${res.status}`)
      }
      const data: DashboardStats = await res.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar estadisticas')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/50 p-4">
        <CardContent className="flex items-center gap-3 p-0">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-800">Error al cargar el dashboard</p>
            <p className="text-xs text-red-600">{error}</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => { setIsLoading(true); fetchStats() }}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : stats ? (
          <>
            <Card className="p-4">
              <CardContent className="space-y-1 p-0">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5" />
                  Pagos Pendientes
                </p>
                <p className="text-2xl font-bold tabular-nums">{stats.pendingPayments}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.pendingPayments === 0 ? 'Sin pagos por verificar' : 'Requieren tu atencion'}
                </p>
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardContent className="space-y-1 p-0">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  Viajes
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  {stats.publishedTrips}
                  <span className="text-sm font-normal text-muted-foreground">/{stats.totalTrips}</span>
                </p>
                <p className="text-xs text-muted-foreground">publicados de {stats.totalTrips} total</p>
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardContent className="space-y-1 p-0">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Cotizaciones
                </p>
                <p className="text-2xl font-bold tabular-nums">{stats.totalOrders}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.unassignedOrders > 0
                    ? <span className="font-medium text-orange-600">{stats.unassignedOrders} sin agente asignado</span>
                    : 'Todas asignadas'}
                </p>
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardContent className="space-y-1 p-0">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Ultima Sync Odoo
                </p>
                <p className="text-lg font-bold">
                  {stats.lastSyncAt ? formatRelativeTime(stats.lastSyncAt) : 'Nunca'}
                </p>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                  <Link href="/admin/odoo-sync">Sincronizar ahora</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Alerts */}
      {stats && stats.pendingPayments > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                {stats.pendingPayments} pago{stats.pendingPayments > 1 ? 's' : ''} pendiente{stats.pendingPayments > 1 ? 's' : ''} de verificacion
              </p>
              <p className="text-xs text-red-600">Revisa los comprobantes lo antes posible</p>
            </div>
            <Button variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-100" asChild>
              <Link href="/admin/verification">Revisar</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {stats && stats.unassignedOrders > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-5 w-5 shrink-0 text-orange-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800">
                {stats.unassignedOrders} lead{stats.unassignedOrders > 1 ? 's' : ''} sin agente asignado
              </p>
              <p className="text-xs text-orange-600">Asigna un agente para dar seguimiento</p>
            </div>
            <Button variant="outline" size="sm" className="border-orange-300 text-orange-700 hover:bg-orange-100" asChild>
              <Link href="/admin/leads">Asignar</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick access */}
      <div className="grid gap-4 sm:grid-cols-2">
        {QUICK_ACCESS.map((item) => (
          <Link key={item.href} href={item.href} className="group">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3 text-base">
                  <span className={item.color}>{item.icon}</span>
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Abrir <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

const QUICK_ACCESS = [
  {
    title: 'Verificacion de Pagos',
    description: 'Revisar comprobantes pendientes de aprobacion',
    href: '/admin/verification',
    icon: <CreditCard className="h-6 w-6" />,
    color: 'text-green-600',
  },
  {
    title: 'Gestion de Viajes',
    description: 'Ver viajes activos, borradores y datos sincronizados',
    href: '/admin/trips',
    icon: <Map className="h-6 w-6" />,
    color: 'text-blue-600',
  },
  {
    title: 'Leads Sin Asignar',
    description: 'Clientes potenciales pendientes de asignacion a agente',
    href: '/admin/leads',
    icon: <Users className="h-6 w-6" />,
    color: 'text-orange-600',
  },
  {
    title: 'Sincronizar Odoo',
    description: 'Actualizar datos de usuarios y viajes desde Odoo',
    href: '/admin/odoo-sync',
    icon: <RefreshCw className="h-6 w-6" />,
    color: 'text-purple-600',
  },
]
