import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function DirectorDashboardPage() {
  return (
    <div className="space-y-6 p-4">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Dashboard Ejecutivo</h1>
      {/* KPI area - horizontal scroll on mobile */}
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 lg:grid lg:grid-cols-4 lg:overflow-visible lg:mx-0 lg:px-0">
        {['Ventas Totales', 'Agentes Activos', 'Cobros Pendientes', 'Conversion'].map((title) => (
          <Card key={title} className="min-w-[200px] snap-start p-4 lg:min-w-0">
            <CardContent className="p-0 space-y-2">
              <p className="text-xs text-muted-foreground">{title}</p>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Placeholder — Epic 5 implementa dashboard BI</p>
    </div>
  )
}
