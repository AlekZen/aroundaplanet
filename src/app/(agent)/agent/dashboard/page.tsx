import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function AgentDashboardPage() {
  return (
    <div className="space-y-6 p-4">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Mi Negocio</h1>
      <div className="grid grid-cols-2 gap-4">
        {['Clientes Activos', 'Comisiones', 'Pagos Pendientes', 'Viajes'].map((title) => (
          <Card key={title} className="p-4">
            <CardContent className="p-0 space-y-2">
              <p className="text-xs text-muted-foreground">{title}</p>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Placeholder — Epic 4 implementa portal agente</p>
    </div>
  )
}
