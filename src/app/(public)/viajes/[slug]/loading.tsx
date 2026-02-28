export default function TripLandingLoading() {
  return (
    <div className="space-y-12 pb-8" aria-busy="true" aria-label="Cargando viaje">
      {/* Hero skeleton */}
      <div className="relative flex min-h-[50vh] items-center justify-center overflow-hidden rounded-xl bg-muted animate-pulse lg:min-h-[60vh]">
        <div className="relative z-10 space-y-4 px-4 text-center">
          <div className="mx-auto h-6 w-24 rounded-full bg-muted-foreground/20" />
          <div className="mx-auto h-10 w-80 rounded bg-muted-foreground/20" />
          <div className="mx-auto h-6 w-64 rounded bg-muted-foreground/20" />
          <div className="mx-auto h-10 w-40 rounded bg-muted-foreground/20" />
        </div>
      </div>

      {/* Info skeleton */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* Description skeleton */}
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* Departures skeleton */}
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-2">
                <div className="h-5 w-40 animate-pulse rounded bg-muted" />
                <div className="h-5 w-28 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Testimonials skeleton */}
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="rounded-lg border p-12">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-muted" />
          <div className="mx-auto mt-4 h-5 w-64 animate-pulse rounded bg-muted" />
          <div className="mx-auto mt-2 h-4 w-48 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}
