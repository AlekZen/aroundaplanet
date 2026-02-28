'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics'
import type { PublicTrip } from '@/types/trip'

interface TripAnalyticsProps {
  trip: PublicTrip
}

export function TripAnalytics({ trip }: TripAnalyticsProps) {
  useEffect(() => {
    trackEvent('view_item', {
      item_id: trip.id,
      item_name: trip.odooName,
      price: trip.odooListPriceCentavos / 100,
      currency: trip.odooCurrencyCode,
      item_category: trip.odooCategory,
    })
  }, [trip.id, trip.odooName, trip.odooListPriceCentavos, trip.odooCurrencyCode, trip.odooCategory])

  return null
}
