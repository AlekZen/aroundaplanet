import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface SkeletonPageProps {
  className?: string
  /** Number of content blocks to show */
  blocks?: number
}

export function SkeletonPage({ className, blocks = 3 }: SkeletonPageProps) {
  return (
    <div className={cn('space-y-6 p-4', className)}>
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Content blocks */}
      {Array.from({ length: blocks }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      ))}
    </div>
  )
}
