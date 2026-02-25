import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface BusinessMetricProps {
  label: string
  value: string | number
  comparison?: { label: string; value: string | number; direction: 'up' | 'down' }
  variant?: 'default' | 'highlight'
  className?: string
}

export function BusinessMetric({ label, value, comparison, variant = 'default', className }: BusinessMetricProps) {
  return (
    <Card className={cn('p-4', variant === 'highlight' && 'bg-accent-muted border-accent/20', className)} aria-label={`${label}: ${value}`}>
      <CardContent className="p-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-mono text-2xl font-medium text-foreground">{value}</p>
        {comparison && (
          <div className={cn('flex items-center gap-1 text-xs mt-1', comparison.direction === 'up' ? 'text-green-600' : 'text-destructive')}>
            {comparison.direction === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{comparison.value} {comparison.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
