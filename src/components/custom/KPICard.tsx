import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  trend?: { direction: 'up' | 'down' | 'flat'; percentage: number }
  isLoading?: boolean
  variant?: 'compact' | 'expanded'
  className?: string
}

const TREND_ICONS = { up: TrendingUp, down: TrendingDown, flat: Minus }
const TREND_COLORS = { up: 'text-green-600', down: 'text-destructive', flat: 'text-muted-foreground' }

export function KPICard({ title, value, trend, isLoading, variant = 'compact', className }: KPICardProps) {
  if (isLoading) {
    return (
      <Card className={cn('p-4', className)}>
        <CardContent className="p-0 space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    )
  }

  const TrendIcon = trend ? TREND_ICONS[trend.direction] : null

  return (
    <Card className={cn('p-4', className)} aria-label={`${title}: ${value}`}>
      <CardContent className="p-0">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className={cn('font-mono font-medium text-foreground', variant === 'expanded' ? 'text-3xl' : 'text-2xl')}>{value}</p>
        {trend && TrendIcon && (
          <div className={cn('flex items-center gap-1 text-xs mt-1', TREND_COLORS[trend.direction])}>
            <TrendIcon className="h-3 w-3" />
            <span>{trend.percentage}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
