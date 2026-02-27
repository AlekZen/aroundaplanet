'use client'

import { useState } from 'react'
import { Collapsible } from 'radix-ui'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ProfileSectionProps {
  title: string
  icon?: React.ReactNode
  defaultOpen?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}

export function ProfileSection({
  title,
  icon,
  defaultOpen = false,
  badge,
  children,
}: ProfileSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <Collapsible.Trigger asChild>
          <CardHeader
            className="cursor-pointer select-none"
            role="button"
            aria-expanded={isOpen}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {icon}
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
                {badge}
              </div>
              <ChevronDown
                className={cn(
                  'h-5 w-5 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </div>
          </CardHeader>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <CardContent className="pt-0">{children}</CardContent>
        </Collapsible.Content>
      </Card>
    </Collapsible.Root>
  )
}
