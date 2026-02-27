'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Search, ImageIcon, Star, FileText, ShoppingCart, Calendar, Users } from 'lucide-react'

const DEBOUNCE_MS = 300
const EDITORIAL_FIELD_COUNT = 7
const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'published', label: 'Publicados' },
  { value: 'draft', label: 'Borradores' },
  { value: 'with-departures', label: 'Con Salidas' },
] as const

type TripFilter = (typeof FILTERS)[number]['value']

interface TripListItem {
  id: string
  odooName: string
  odooListPriceCentavos: number
  odooCurrencyCode: string
  odooCategory: string
  isPublished: boolean
  isActive: boolean
  slug: string
  emotionalCopy: string
  tags: string[]
  highlights: string[]
  difficulty: string | null
  seoTitle: string
  seoDescription: string
  heroImages: string[]
  hasOdooImage: boolean
  odooProductId: number | null
  odooSalesCount: number
  odooIsFavorite: boolean
  odooDocumentCount: number
  lastSyncAt: { _seconds?: number; seconds?: number } | null
  nextDepartureDate: { _seconds?: number; seconds?: number } | null
  nextDepartureEndDate: { _seconds?: number; seconds?: number } | null
  totalDepartures: number
  totalSeatsMax: number
  totalSeatsAvailable: number
}

interface FetchState {
  trips: TripListItem[]
  nextCursor: string | null
  total: number
  isLoading: boolean
  error: string | null
}

function timestampToDate(ts: unknown): Date | null {
  if (!ts || typeof ts !== 'object') return null
  const obj = ts as Record<string, unknown>
  const seconds = (obj.seconds ?? obj._seconds) as number | undefined
  return typeof seconds === 'number' ? new Date(seconds * 1000) : null
}

function formatPrice(centavos: number, currency: string): string {
  const amount = centavos / 100
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    maximumFractionDigits: 0,
  }).format(amount)
}

const ODOO_IMAGE_BASE = 'https://aroundaplanet.odoo.com/web/image/product.template'

function getThumbUrl(trip: TripListItem): string | null {
  if (trip.heroImages.length > 0) return trip.heroImages[0]
  if (trip.hasOdooImage && trip.odooProductId) {
    return `${ODOO_IMAGE_BASE}/${trip.odooProductId}/image_256`
  }
  return null
}

function computeCompleteness(trip: TripListItem): number {
  let filled = 0
  if (trip.slug) filled++
  if (trip.emotionalCopy) filled++
  if (trip.tags.length > 0) filled++
  if (trip.highlights.length > 0) filled++
  if (trip.difficulty) filled++
  if (trip.seoTitle) filled++
  if (trip.seoDescription) filled++
  return filled
}

function formatShortDate(ts: unknown): string | null {
  const date = timestampToDate(ts)
  if (!date) return null
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getOccupancyColor(seatsMax: number, seatsAvailable: number): string {
  if (seatsMax === 0) return 'text-muted-foreground'
  const occupancyPercent = ((seatsMax - seatsAvailable) / seatsMax) * 100
  if (occupancyPercent >= 80) return 'text-green-600'
  if (occupancyPercent >= 50) return 'text-amber-600'
  return 'text-red-600'
}

export function TripListPanel() {
  const router = useRouter()
  const pathname = usePathname()
  const basePath = pathname?.startsWith('/superadmin')
    ? '/superadmin/trips'
    : pathname?.startsWith('/director')
      ? '/director/trips'
      : '/admin/trips'
  const [state, setState] = useState<FetchState>({
    trips: [], nextCursor: null, total: 0, isLoading: true, error: null,
  })
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<TripFilter>('all')

  const fetchTrips = useCallback(async (params: {
    search?: string; filter?: TripFilter; cursor?: string
  }) => {
    setState((s) => ({ ...s, isLoading: true, error: null }))
    try {
      const query = new URLSearchParams()
      if (params.search) query.set('search', params.search)
      if (params.filter && params.filter !== 'all') query.set('filter', params.filter)
      if (params.cursor) query.set('cursor', params.cursor)

      const res = await fetch(`/api/trips?${query.toString()}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Error al cargar viajes')
      }
      const data = await res.json()
      setState((prev) => ({
        trips: params.cursor ? [...prev.trips, ...(data.trips ?? [])] : (data.trips ?? []),
        nextCursor: data.nextCursor ?? null,
        total: data.total ?? 0,
        isLoading: false,
        error: null,
      }))
    } catch (err) {
      setState((s) => ({
        ...s, isLoading: false,
        error: err instanceof Error ? err.message : 'Error desconocido',
      }))
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTrips({ search, filter })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search, filter, fetchTrips])

  const handleNavigateEdit = (tripId: string) => {
    router.push(`${basePath}/${tripId}`)
  }

  // Compute summary stats
  const publishedCount = state.trips.filter((t) => t.isPublished).length
  const draftCount = state.trips.filter((t) => !t.isPublished).length
  const withImagesCount = state.trips.filter((t) => t.heroImages.length > 0 || t.hasOdooImage).length

  // Skeleton loading
  if (state.isLoading && state.trips.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-2xl font-semibold">{state.total}</p>
            <p className="text-xs text-muted-foreground">Total viajes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-2xl font-semibold text-primary">{publishedCount}</p>
            <p className="text-xs text-muted-foreground">Publicados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-2xl font-semibold text-muted-foreground">{draftCount}</p>
            <p className="text-xs text-muted-foreground">Borradores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-2xl font-semibold">{withImagesCount}</p>
            <p className="text-xs text-muted-foreground">Con imagenes</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Buscar viajes"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Error */}
      {state.error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {state.error}
          <Button variant="link" size="sm" onClick={() => fetchTrips({ search, filter })}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!state.isLoading && state.trips.length === 0 && !state.error && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {search ? 'No se encontraron viajes con ese nombre' : 'No hay viajes sincronizados aun'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Desktop: Table */}
      {state.trips.length > 0 && (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Viaje</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ventas</TableHead>
                  <TableHead>Docs</TableHead>
                  <TableHead>Proxima Salida</TableHead>
                  <TableHead>Asientos</TableHead>
                  <TableHead>Editorial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.trips.map((trip) => {
                  const completeness = computeCompleteness(trip)
                  const completenessPercent = Math.round((completeness / EDITORIAL_FIELD_COUNT) * 100)
                  const thumbnail = getThumbUrl(trip)
                  return (
                    <TableRow
                      key={trip.id}
                      className="cursor-pointer"
                      onClick={() => handleNavigateEdit(trip.id)}
                    >
                      {/* Thumbnail */}
                      <TableCell className="pr-0">
                        <div className="relative h-10 w-10 overflow-hidden rounded bg-muted flex items-center justify-center shrink-0">
                          {thumbnail ? (
                            <Image
                              src={thumbnail}
                              alt=""
                              width={40}
                              height={40}
                              className="h-10 w-10 object-cover"
                              unoptimized={thumbnail.includes('odoo.com')}
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                          )}
                          {trip.odooIsFavorite && (
                            <Star className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          )}
                        </div>
                      </TableCell>

                      {/* Name + Category + Tags */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium leading-tight">{trip.odooName}</p>
                          <div className="flex items-center gap-1.5">
                            {trip.odooCategory && (
                              <span className="text-xs text-muted-foreground">{trip.odooCategory}</span>
                            )}
                            {trip.tags.length > 0 && (
                              <div className="flex gap-1">
                                {trip.tags.slice(0, 2).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0">
                                    {tag}
                                  </Badge>
                                ))}
                                {trip.tags.length > 2 && (
                                  <span className="text-[10px] text-muted-foreground">+{trip.tags.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Price */}
                      <TableCell className="tabular-nums">
                        {formatPrice(trip.odooListPriceCentavos, trip.odooCurrencyCode)}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={trip.isPublished ? 'default' : 'secondary'}>
                            {trip.isPublished ? 'Publicado' : 'Borrador'}
                          </Badge>
                          {!trip.isActive && (
                            <Badge variant="destructive" className="text-[10px]">Inactivo</Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Sales count */}
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <ShoppingCart className="h-3.5 w-3.5" />
                          <span className="tabular-nums">{trip.odooSalesCount}</span>
                        </div>
                      </TableCell>

                      {/* Document count */}
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          <span className="tabular-nums">{trip.odooDocumentCount}</span>
                        </div>
                      </TableCell>

                      {/* Next departure */}
                      <TableCell>
                        {trip.nextDepartureDate ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{formatShortDate(trip.nextDepartureDate)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin salidas</span>
                        )}
                      </TableCell>

                      {/* Seats */}
                      <TableCell>
                        {trip.totalDepartures > 0 ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Users className={`h-3.5 w-3.5 ${getOccupancyColor(trip.totalSeatsMax, trip.totalSeatsAvailable)}`} />
                            <span className={`tabular-nums ${getOccupancyColor(trip.totalSeatsMax, trip.totalSeatsAvailable)}`}>
                              {trip.totalSeatsMax - trip.totalSeatsAvailable}/{trip.totalSeatsMax}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Editorial completeness */}
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <Progress value={completenessPercent} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {completeness}/{EDITORIAL_FIELD_COUNT}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: Cards */}
          <div className="space-y-3 md:hidden">
            {state.trips.map((trip) => {
              const completeness = computeCompleteness(trip)
              const completenessPercent = Math.round((completeness / EDITORIAL_FIELD_COUNT) * 100)
              const thumbnail = getThumbUrl(trip)
              return (
                <Card
                  key={trip.id}
                  className="cursor-pointer"
                  onClick={() => handleNavigateEdit(trip.id)}
                >
                  <CardContent className="flex gap-3 py-3">
                    {/* Thumbnail */}
                    <div className="relative h-14 w-14 overflow-hidden rounded bg-muted flex items-center justify-center shrink-0">
                      {thumbnail ? (
                        <Image
                          src={thumbnail}
                          alt=""
                          width={56}
                          height={56}
                          className="h-14 w-14 object-cover"
                          unoptimized={thumbnail.includes('odoo.com')}
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                      )}
                      {trip.odooIsFavorite && (
                        <Star className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight truncate">{trip.odooName}</p>
                        <Badge variant={trip.isPublished ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                          {trip.isPublished ? 'Pub' : 'Draft'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatPrice(trip.odooListPriceCentavos, trip.odooCurrencyCode)}</span>
                        {trip.odooCategory && (
                          <>
                            <span>·</span>
                            <span>{trip.odooCategory}</span>
                          </>
                        )}
                        {trip.nextDepartureDate && (
                          <>
                            <span>·</span>
                            <Calendar className="h-3 w-3" />
                            <span>{formatShortDate(trip.nextDepartureDate)}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={completenessPercent} className="h-1 flex-1" />
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {completeness}/{EDITORIAL_FIELD_COUNT}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      {state.nextCursor && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => fetchTrips({ search, filter, cursor: state.nextCursor ?? undefined })}
            disabled={state.isLoading}
          >
            {state.isLoading ? 'Cargando...' : 'Cargar mas'}
          </Button>
        </div>
      )}
    </div>
  )
}
