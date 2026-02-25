import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function VerificationPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Cola de Verificacion</h1>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <CardContent className="p-0 flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Placeholder — Epic 3 implementa verificacion de pagos</p>
    </div>
  )
}
