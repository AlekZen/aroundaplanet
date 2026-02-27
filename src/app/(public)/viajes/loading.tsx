import { CatalogSkeleton } from './CatalogSkeleton'

export default function CatalogLoading() {
  return (
    <div className="space-y-8 py-8">
      <div className="space-y-2">
        <div className="h-9 w-72 bg-muted animate-pulse rounded" />
        <div className="h-6 w-96 bg-muted animate-pulse rounded" />
      </div>
      <CatalogSkeleton />
    </div>
  )
}
