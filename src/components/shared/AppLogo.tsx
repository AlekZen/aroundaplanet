import Image from 'next/image'
import { cn } from '@/lib/utils'

export type AppLogoSize = 'sm' | 'md' | 'lg'

interface AppLogoProps {
  size?: AppLogoSize
  className?: string
  priority?: boolean
}

const SIZE_PX: Record<AppLogoSize, number> = {
  sm: 32,
  md: 48,
  lg: 80,
}

export function AppLogo({ size = 'md', className, priority = false }: AppLogoProps) {
  const px = SIZE_PX[size]
  return (
    <Image
      src="/images/aroundaplanet-logo.png"
      alt="AroundaPlanet Travel Agency"
      width={px}
      height={px}
      priority={priority}
      className={cn('object-contain', className)}
      style={{ height: px, width: px }}
    />
  )
}
