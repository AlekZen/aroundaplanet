import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function SyncConsoleLoading() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-4">
            <CardContent className="p-0 space-y-2">
              <Skeleton className="h-4 w-24 animate-pulse" />
              <Skeleton className="h-8 w-16 animate-pulse" />
              <Skeleton className="h-3 w-32 animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full animate-pulse" />
    </div>
  )
}
