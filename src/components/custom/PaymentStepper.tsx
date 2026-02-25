import { cn, formatCurrency } from '@/lib/utils'
import { Check, Clock, X, Circle } from 'lucide-react'

interface PaymentStepperProps {
  steps: Array<{ id: string; label: string; status: 'completed' | 'current' | 'rejected' | 'upcoming'; icon?: React.ReactNode; timestamp?: string; amount?: number }>
  className?: string
}

const STATUS_CONFIG = {
  completed: { color: 'text-green-600 bg-green-100', icon: Check },
  current: { color: 'text-accent bg-accent-muted', icon: Clock },
  rejected: { color: 'text-destructive bg-destructive-muted', icon: X },
  upcoming: { color: 'text-muted-foreground bg-muted', icon: Circle },
}

export function PaymentStepper({ steps, className }: PaymentStepperProps) {
  return (
    <ol role="list" className={cn('space-y-4', className)}>
      {steps.map((step, index) => {
        const config = STATUS_CONFIG[step.status]
        const IconComponent = step.icon
          ? ({ className: iconClassName }: { className?: string }) => <span className={iconClassName}>{step.icon}</span>
          : config.icon
        return (
          <li key={step.id} className="relative flex items-start gap-3" aria-current={step.status === 'current' ? 'step' : undefined}>
            <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', config.color)}>
              <IconComponent className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-medium', step.status === 'upcoming' ? 'text-muted-foreground' : 'text-foreground')}>{step.label}</p>
              {step.timestamp && <p className="text-xs text-muted-foreground">{step.timestamp}</p>}
              {step.amount != null && <p className="font-mono text-sm text-foreground">{formatCurrency(step.amount)}</p>}
            </div>
            {index < steps.length - 1 && <div className="absolute left-4 top-8 h-full w-0.5 bg-border" />}
          </li>
        )
      })}
    </ol>
  )
}
