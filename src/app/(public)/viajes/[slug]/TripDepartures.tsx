'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { PublicDeparture } from '@/types/trip'

interface TripDeparturesProps {
  departures: PublicDeparture[]
  tripId: string
  tripName: string
  onSelectDeparture?: (departureId: string) => void
}

interface OccupancyInfo {
  text: string
  className: string
  icon: string
}

function getOccupancyInfo(dep: PublicDeparture): OccupancyInfo {
  if (dep.seatsMax === 0) {
    return { text: 'Sin plazas', className: 'bg-muted text-muted-foreground', icon: '—' }
  }
  const pctAvailable = dep.seatsAvailable / dep.seatsMax
  if (dep.seatsAvailable === 0) {
    return { text: 'Agotado', className: 'bg-red-100 text-red-800', icon: '✕' }
  }
  if (pctAvailable < 0.2) {
    const plural = dep.seatsAvailable === 1 ? '' : 'es'
    return { text: `Solo ${dep.seatsAvailable} lugar${plural} — reserva ya!`, className: 'bg-red-100 text-red-800', icon: '!' }
  }
  if (pctAvailable < 0.5) {
    return { text: `${dep.seatsAvailable} disponibles`, className: 'bg-yellow-100 text-yellow-800', icon: '△' }
  }
  return { text: `${dep.seatsAvailable} disponibles`, className: 'bg-green-100 text-green-800', icon: '✓' }
}

function computeCountdownText(startDate: string): string | null {
  const now = new Date()
  const departure = new Date(startDate)
  const diffMs = departure.getTime() - now.getTime()
  if (diffMs <= 0) return null
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays > 30) return null
  return `Sale en ${diffDays} dia${diffDays === 1 ? '' : 's'}`
}

/** Compute countdowns client-side only to avoid hydration mismatch */
function useCountdowns(departures: PublicDeparture[]): Map<string, string> {
  const [countdowns, setCountdowns] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    const map = new Map<string, string>()
    for (const dep of departures) {
      const text = computeCountdownText(dep.startDate)
      if (text) map.set(dep.id, text)
    }
    setCountdowns(map)
  }, [departures])

  return countdowns
}

function formatDepartureDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function TripDepartures({ departures, tripId, tripName, onSelectDeparture }: TripDeparturesProps) {
  const countdowns = useCountdowns(departures)

  if (departures.length === 0) {
    return (
      <section className="space-y-4" aria-label="Proximas salidas">
        <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Proximas Salidas
        </h2>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="text-4xl" aria-hidden="true">🌍</div>
            <p className="text-lg font-medium text-foreground">
              Proximas salidas en preparacion
            </p>
            <p className="max-w-md text-muted-foreground">
              Estamos organizando nuevas fechas para este destino.
              Contacta a nuestro equipo para ser el primero en enterarte.
            </p>
            <Button asChild className="mt-2 bg-accent text-accent-foreground hover:bg-accent/90">
              <Link href="/contacto">Contactar Equipo</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-4" aria-label="Proximas salidas">
      <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
        Proximas Salidas
      </h2>

      {/* Mobile: cards */}
      <div className="space-y-3 lg:hidden">
        {departures.map((dep) => {
          const occupancy = getOccupancyInfo(dep)
          const isSoldOut = dep.seatsAvailable === 0
          const countdown = countdowns.get(dep.id)

          return (
            <Card key={dep.id} aria-label={`Salida ${formatDepartureDate(dep.startDate)}`}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {formatDepartureDate(dep.startDate)}
                  </p>
                  {countdown && (
                    <p className="text-sm font-medium text-orange-600">{countdown}</p>
                  )}
                  <Badge className={cn('text-xs', occupancy.className)}>
                    <span aria-hidden="true" className="mr-1">{occupancy.icon}</span>
                    {occupancy.text}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  disabled={isSoldOut}
                  className={cn(
                    'min-h-11 shrink-0',
                    isSoldOut
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-accent text-accent-foreground hover:bg-accent/90'
                  )}
                  onClick={() => {
                    if (!isSoldOut) {
                      onSelectDeparture?.(dep.id)
                    }
                  }}
                >
                  {isSoldOut ? 'Agotado' : 'Apartar Lugar'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden lg:block">
        <table className="w-full" role="table">
          <thead>
            <tr className="border-b text-left text-sm text-muted-foreground">
              <th className="pb-3 font-medium">Fecha</th>
              <th className="pb-3 font-medium">Disponibilidad</th>
              <th className="pb-3 text-right font-medium">Accion</th>
            </tr>
          </thead>
          <tbody>
            {departures.map((dep) => {
              const occupancy = getOccupancyInfo(dep)
              const isSoldOut = dep.seatsAvailable === 0
              const countdown = countdowns.get(dep.id)

              return (
                <tr key={dep.id} className="border-b last:border-b-0">
                  <td className="py-4">
                    <span className="font-medium text-foreground">
                      {formatDepartureDate(dep.startDate)}
                    </span>
                    {countdown && (
                      <p className="text-sm font-medium text-orange-600">{countdown}</p>
                    )}
                  </td>
                  <td className="py-4">
                    <Badge className={cn('text-xs', occupancy.className)}>
                      <span aria-hidden="true" className="mr-1">{occupancy.icon}</span>
                      {occupancy.text}
                    </Badge>
                  </td>
                  <td className="py-4 text-right">
                    <Button
                      size="sm"
                      disabled={isSoldOut}
                      className={cn(
                        'min-h-11',
                        isSoldOut
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-accent text-accent-foreground hover:bg-accent/90'
                      )}
                      onClick={() => {
                        if (!isSoldOut) {
                          onSelectDeparture?.(dep.id)
                        }
                      }}
                    >
                      {isSoldOut ? 'Agotado' : 'Apartar Lugar'}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
