import type { UserRole } from '@/types/user'
import { ROLE_COLORS, ROLE_LABELS } from '@/config/roles'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface RoleBadgeProps {
  role: UserRole
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const colors = ROLE_COLORS[role]
  const label = ROLE_LABELS[role]

  return (
    <Badge
      variant="secondary"
      className={cn(colors.bg, colors.text)}
      aria-label={label}
    >
      {label}
    </Badge>
  )
}
