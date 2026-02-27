import { TripCardSkeleton } from '@/components/custom/TripCard'

export function CatalogSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter skeletons */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-4 w-14 bg-muted animate-pulse rounded" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 w-20 bg-muted animate-pulse rounded-full" />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-4 w-12 bg-muted animate-pulse rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-6 w-24 bg-muted animate-pulse rounded-full" />
          ))}
        </div>
      </div>

      {/* Grid skeleton */}
      <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 list-none p-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <TripCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  )
}
