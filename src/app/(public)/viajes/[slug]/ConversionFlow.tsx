'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/useAuthStore'
import { trackEvent } from '@/lib/analytics'
import { TripDepartures } from './TripDepartures'
import { TripStickyCTA } from './TripStickyCTA'
import { ConversionForm } from './ConversionForm'
import type { PublicDeparture } from '@/types/trip'

interface ConversionFlowProps {
  tripId: string
  tripName: string
  tripSlug: string
  tripPrice: number
  departures: PublicDeparture[]
}

function getAttributionData() {
  if (typeof window === 'undefined') return {}
  return {
    utmSource: sessionStorage.getItem('attribution_utm_source') ?? undefined,
    utmMedium: sessionStorage.getItem('attribution_utm_medium') ?? undefined,
    utmCampaign: sessionStorage.getItem('attribution_utm_campaign') ?? undefined,
    agentId: sessionStorage.getItem('attribution_ref') ?? undefined,
  }
}

function ConversionFlowInner({
  tripId,
  tripName,
  tripSlug,
  tripPrice,
  departures,
}: ConversionFlowProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading } = useAuthStore()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedDepartureId, setSelectedDepartureId] = useState<string | null>(null)

  // Auto-open from URL params after login redirect
  useEffect(() => {
    if (isLoading) return

    const shouldOpen = searchParams.get('cotizar') === 'true'
    if (shouldOpen && isAuthenticated) {
      const depId = searchParams.get('salida')
      if (depId) setSelectedDepartureId(depId)
      setIsFormOpen(true)
      sessionStorage.removeItem('pendingQuote')
    }
  }, [searchParams, isAuthenticated, isLoading])

  function handleQuoteClick() {
    trackEvent('begin_checkout', {
      item_id: tripId,
      item_name: tripName,
    })

    if (isLoading) return

    if (!isAuthenticated) {
      const depParam = selectedDepartureId ? `&salida=${selectedDepartureId}` : ''
      const returnUrl = `/viajes/${tripSlug}?cotizar=true${depParam}`
      sessionStorage.setItem('pendingQuote', JSON.stringify({ tripId, departureId: selectedDepartureId }))
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)
      return
    }

    setIsFormOpen(true)
  }

  function handleSelectDeparture(departureId: string) {
    const dep = departures.find((d) => d.id === departureId)
    if (dep) {
      trackEvent('select_item', {
        item_id: tripId,
        item_name: tripName,
        departure_id: departureId,
        departure_date: dep.startDate,
      })
    }

    setSelectedDepartureId(departureId)

    if (isLoading) return

    if (!isAuthenticated) {
      const returnUrl = `/viajes/${tripSlug}?cotizar=true&salida=${departureId}`
      sessionStorage.setItem('pendingQuote', JSON.stringify({ tripId, departureId }))
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)
      return
    }

    setIsFormOpen(true)
  }

  return (
    <>
      <TripDepartures
        departures={departures}
        tripId={tripId}
        tripName={tripName}
        onSelectDeparture={handleSelectDeparture}
      />
      <TripStickyCTA
        onQuoteClick={handleQuoteClick}
      />
      <ConversionForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        tripId={tripId}
        tripName={tripName}
        tripPrice={tripPrice}
        departures={departures}
        selectedDepartureId={selectedDepartureId}
        attributionData={getAttributionData()}
      />
    </>
  )
}

export function ConversionFlow(props: ConversionFlowProps) {
  return (
    <Suspense fallback={<DeparturesSkeleton />}>
      <ConversionFlowInner {...props} />
    </Suspense>
  )
}

function DeparturesSkeleton() {
  return (
    <div className="space-y-4" aria-label="Cargando salidas">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  )
}
