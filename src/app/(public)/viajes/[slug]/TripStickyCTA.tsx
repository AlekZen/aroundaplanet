'use client'

import { Button } from '@/components/ui/button'

interface TripStickyCTAProps {
  onQuoteClick?: () => void
}

export function TripStickyCTA({ onQuoteClick }: TripStickyCTAProps) {
  function handleClick() {
    onQuoteClick?.()
  }

  return (
    <>
      {/* Desktop: inline CTA at bottom of page */}
      <div className="hidden lg:block">
        <Button
          size="lg"
          className="min-h-12 bg-accent px-8 text-lg font-semibold text-accent-foreground shadow-lg hover:bg-accent/90"
          onClick={handleClick}
        >
          Cotizar Ahora
        </Button>
      </div>

      {/* Mobile: sticky CTA at bottom */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] backdrop-blur lg:hidden"
        role="complementary"
        aria-label="Accion principal"
      >
        <Button
          className="h-12 w-full bg-accent text-lg font-semibold text-accent-foreground shadow-lg hover:bg-accent/90"
          onClick={handleClick}
        >
          Cotizar
        </Button>
      </div>
    </>
  )
}
