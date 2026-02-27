'use client'

import { useMemo, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TripCard } from '@/components/custom/TripCard'
import { trackEvent } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils'
import type { PublicTrip } from '@/types/trip'

const PRICE_RANGES = [
  { label: 'Hasta $50K', min: 0, max: 5_000_000 },
  { label: '$50K — $100K', min: 5_000_001, max: 10_000_000 },
  { label: 'Mas de $100K', min: 10_000_001, max: Infinity },
] as const

function formatDepartureDate(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

function formatDepartureDateShort(isoDate: string): string {
  const date = new Date(isoDate)
  const month = date.toLocaleDateString('es-MX', { month: 'short' })
  const year = date.getFullYear()
  return `${month} ${year}`
}

function getDepartureMonth(isoDate: string): string {
  const date = new Date(isoDate)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

interface CatalogContentProps {
  trips: PublicTrip[]
}

export function CatalogContent({ trips }: CatalogContentProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Parse active filters from URL
  const activeDestinations = useMemo(() => {
    const param = searchParams.get('destino')
    return param ? param.split(',').filter(Boolean) : []
  }, [searchParams])

  const activePriceRange = searchParams.get('precio') ?? null

  const activeMonths = useMemo(() => {
    const param = searchParams.get('mes')
    return param ? param.split(',').filter(Boolean) : []
  }, [searchParams])

  // Derive filter options from data
  const destinations = useMemo(() => {
    const unique = new Set(trips.map((t) => t.odooCategory).filter(Boolean))
    return Array.from(unique).sort()
  }, [trips])

  const departureMonths = useMemo(() => {
    const months = new Map<string, string>()
    for (const t of trips) {
      if (t.nextDepartureDate) {
        const key = getDepartureMonth(t.nextDepartureDate)
        if (!months.has(key)) {
          months.set(key, formatDepartureDateShort(t.nextDepartureDate))
        }
      }
    }
    return Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [trips])

  // Update URL search params
  const updateParams = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [searchParams, router, pathname])

  const toggleDestination = useCallback((dest: string) => {
    const next = activeDestinations.includes(dest)
      ? activeDestinations.filter((d) => d !== dest)
      : [...activeDestinations, dest]
    updateParams('destino', next.length > 0 ? next.join(',') : null)
  }, [activeDestinations, updateParams])

  const togglePriceRange = useCallback((rangeLabel: string) => {
    updateParams('precio', activePriceRange === rangeLabel ? null : rangeLabel)
  }, [activePriceRange, updateParams])

  const toggleMonth = useCallback((monthKey: string) => {
    const next = activeMonths.includes(monthKey)
      ? activeMonths.filter((m) => m !== monthKey)
      : [...activeMonths, monthKey]
    updateParams('mes', next.length > 0 ? next.join(',') : null)
  }, [activeMonths, updateParams])

  const clearAllFilters = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [router, pathname])

  const hasActiveFilters = activeDestinations.length > 0 || activePriceRange !== null || activeMonths.length > 0

  // Apply filters in memory
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      // Destination filter
      if (activeDestinations.length > 0 && !activeDestinations.includes(trip.odooCategory)) {
        return false
      }
      // Price range filter
      if (activePriceRange) {
        const range = PRICE_RANGES.find((r) => r.label === activePriceRange)
        if (range && (trip.odooListPriceCentavos < range.min || trip.odooListPriceCentavos > range.max)) {
          return false
        }
      }
      // Departure month filter
      if (activeMonths.length > 0) {
        if (!trip.nextDepartureDate) return false
        const tripMonth = getDepartureMonth(trip.nextDepartureDate)
        if (!activeMonths.includes(tripMonth)) return false
      }
      return true
    })
  }, [trips, activeDestinations, activePriceRange, activeMonths])

  // Analytics: view_item_list on mount
  useEffect(() => {
    trackEvent('view_item_list', {
      item_list_name: 'trip_catalog',
      items: trips.map((t) => ({
        item_id: t.id,
        item_name: t.odooName,
        price: t.odooListPriceCentavos / 100,
        item_category: t.odooCategory,
      })),
    })
  }, [trips])

  const handleTripClick = useCallback((trip: PublicTrip) => {
    trackEvent('select_item', {
      item_list_name: 'trip_catalog',
      items: [{
        item_id: trip.id,
        item_name: trip.odooName,
        price: trip.odooListPriceCentavos / 100,
        item_category: trip.odooCategory,
      }],
    })
  }, [])

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-3">
        {/* Destination chips */}
        {destinations.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground mr-1">Destino:</span>
            {destinations.map((dest) => {
              const isActive = activeDestinations.includes(dest)
              return (
                <Badge
                  key={dest}
                  variant="outline"
                  className={`cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-accent/10 border-accent text-primary'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => toggleDestination(dest)}
                >
                  {dest}
                  {isActive && <X className="ml-1 h-3 w-3" />}
                </Badge>
              )
            })}
          </div>
        )}

        {/* Price range chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground mr-1">Precio:</span>
          {PRICE_RANGES.map((range) => {
            const isActive = activePriceRange === range.label
            return (
              <Badge
                key={range.label}
                variant="outline"
                className={`cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-accent/10 border-accent text-primary'
                    : 'hover:bg-muted'
                }`}
                onClick={() => togglePriceRange(range.label)}
              >
                {range.label}
                {isActive && <X className="ml-1 h-3 w-3" />}
              </Badge>
            )
          })}
        </div>

        {/* Departure month chips */}
        {departureMonths.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground mr-1">Salida:</span>
            {departureMonths.map(([monthKey, monthLabel]) => {
              const isActive = activeMonths.includes(monthKey)
              return (
                <Badge
                  key={monthKey}
                  variant="outline"
                  className={`cursor-pointer transition-colors capitalize ${
                    isActive
                      ? 'bg-accent/10 border-accent text-primary'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => toggleMonth(monthKey)}
                >
                  {monthLabel}
                  {isActive && <X className="ml-1 h-3 w-3" />}
                </Badge>
              )
            })}
          </div>
        )}

        {/* Clear all */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearAllFilters}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Results count */}
      {hasActiveFilters && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {filteredTrips.length} {filteredTrips.length === 1 ? 'viaje encontrado' : 'viajes encontrados'}
        </p>
      )}

      {/* Trip grid */}
      {filteredTrips.length > 0 ? (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 list-none p-0">
          {filteredTrips.map((trip) => {
            const isSoldOut = trip.totalSeatsAvailable === 0 && trip.totalDepartures > 0
            return (
              <li key={trip.id} onClick={isSoldOut ? undefined : () => handleTripClick(trip)}>
                <TripCard
                  trip={{
                    title: trip.odooName,
                    slug: trip.slug,
                    imageUrl: trip.heroImages[0] ?? '/images/trips/placeholder.webp',
                    price: trip.odooListPriceCentavos,
                    dates: trip.nextDepartureDate ? formatDepartureDate(trip.nextDepartureDate) : 'Proximamente',
                    destination: trip.odooCategory || 'Destino',
                  }}
                  variant="public"
                  isSoldOut={isSoldOut}
                  href={trip.slug ? `/viajes/${trip.slug}` : undefined}
                />
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 text-6xl">🌍</div>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
            {hasActiveFilters
              ? 'No hay viajes con esos filtros'
              : 'Pronto habra nuevas aventuras disponibles'}
          </h2>
          <p className="text-muted-foreground max-w-md">
            {hasActiveFilters
              ? 'Intenta cambiar los filtros o limpialos para ver todos los viajes.'
              : 'Mientras tanto, escribenos para recibir informacion sobre proximas salidas.'}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" className="mt-4" onClick={clearAllFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
