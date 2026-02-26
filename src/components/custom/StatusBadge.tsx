import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  isActive: boolean
}

export function StatusBadge({ isActive }: StatusBadgeProps) {
  const label = isActive ? 'Activo' : 'Inactivo'

  return (
    <Badge
      variant="secondary"
      className={cn(
        isActive
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-gray-500'
      )}
      aria-label={label}
    >
      {label}
    </Badge>
  )
}
