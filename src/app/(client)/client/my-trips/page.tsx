import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function MyTripsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Mis Viajes</h1>
      <Card className="p-6">
        <CardContent className="p-0 space-y-4 text-center">
          <Skeleton className="h-3 w-full rounded-full" />
          <p className="text-muted-foreground">Aun no tienes viajes activos</p>
          <p className="text-xs text-muted-foreground">Placeholder — Epic 7 implementa experiencia cliente</p>
        </CardContent>
      </Card>
    </div>
  )
}
