import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

interface EmotionalProgressProps {
  percentage: number
  tripName: string
  destinationHighlight?: string
  userName?: string
  className?: string
}

const MILESTONES = [
  { at: 25, label: 'Preparando tu aventura' },
  { at: 50, label: 'A mitad del camino' },
  { at: 75, label: 'Casi llegas' },
  { at: 100, label: 'Viaje completado' },
]

export function EmotionalProgress({ percentage, tripName, destinationHighlight, userName, className }: EmotionalProgressProps) {
  const milestone = MILESTONES.findLast((m) => percentage >= m.at)

  return (
    <div className={cn('space-y-3', className)} role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso de ${tripName}: ${percentage}%`}>
      {userName && <p className="text-sm text-muted-foreground">Hola, {userName}</p>}
      <h2 className="font-heading text-xl font-semibold text-foreground">{tripName}</h2>
      {destinationHighlight && <p className="text-sm text-accent font-medium">{destinationHighlight}</p>}
      <Progress value={percentage} className="h-3" />
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{milestone?.label}</span>
        <span className="font-mono text-sm font-medium text-foreground">{percentage}%</span>
      </div>
    </div>
  )
}
