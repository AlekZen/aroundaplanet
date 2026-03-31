'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isAuthenticated, user, profile } = useAuthStore()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedDepartureId, setSelectedDepartureId] = useState<string | null>(null)
  const [isEnrolling, setIsEnrolling] = useState(false)

  /** Authenticated user: create order instantly, no form */
  const handleAuthEnroll = useCallback(async () => {
    if (isEnrolling) return
    setIsEnrolling(true)

    try {
      const contactName = profile?.displayName ?? user?.displayName ?? user?.email ?? 'Cliente'
      const contactPhone = profile?.phone ?? undefined
      const attribution = getAttributionData()

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          contactName,
          contactPhone,
          ...attribution,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.message ?? 'Error al procesar la solicitud')
      }

      const data = await res.json()

      trackEvent('generate_lead', {
        trip_id: data.tripId,
        agent_id: attribution.agentId ?? 'sin_asignar',
        utm_source: attribution.utmSource ?? 'direct',
        order_id: data.orderId,
      })

      toast.success('Te inscribiste al viaje')
      router.push('/client/my-trips')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No pudimos procesar tu solicitud'
      toast.error(message)
    } finally {
      setIsEnrolling(false)
    }
  }, [isEnrolling, profile, user, tripId, router])

  // Auto-open from URL params
  useEffect(() => {
    const shouldOpen = searchParams.get('cotizar') === 'true'
    if (shouldOpen) {
      if (isAuthenticated) {
        handleAuthEnroll()
      } else {
        const depId = searchParams.get('salida')
        if (depId) setSelectedDepartureId(depId)
        setIsFormOpen(true)
      }
    }
  }, [searchParams, isAuthenticated, handleAuthEnroll])

  function handleQuoteClick() {
    trackEvent('begin_checkout', {
      item_id: tripId,
      item_name: tripName,
    })

    if (isAuthenticated) {
      handleAuthEnroll()
    } else {
      setIsFormOpen(true)
    }
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

    if (isAuthenticated) {
      setSelectedDepartureId(departureId)
      handleAuthEnroll()
    } else {
      setSelectedDepartureId(departureId)
      setIsFormOpen(true)
    }
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
        isLoading={isEnrolling}
      />
      {!isAuthenticated && (
        <ConversionForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          tripId={tripId}
          tripName={tripName}
          tripSlug={tripSlug}
          tripPrice={tripPrice}
          departures={departures}
          selectedDepartureId={selectedDepartureId}
          attributionData={getAttributionData()}
          isAuthenticated={false}
        />
      )}
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
