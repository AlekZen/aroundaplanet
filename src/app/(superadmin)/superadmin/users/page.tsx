import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function UsersManagementPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Gestion de Usuarios</h1>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <CardContent className="p-0 flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Placeholder — Story 1.6 implementa panel SuperAdmin</p>
    </div>
  )
}
