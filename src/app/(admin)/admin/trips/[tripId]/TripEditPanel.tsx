'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import Image from 'next/image'
import { useAutoSave } from '@/hooks/useAutoSave'
import { generateSlug } from '@/lib/utils/slugify'
import type { TripDocument, OdooDocument } from '@/types/trip'

// === Constants ===

const EDITORIAL_FIELDS = ['slug', 'emotionalCopy', 'tags', 'highlights', 'difficulty', 'seoTitle', 'seoDescription'] as const
const DIFFICULTY_OPTIONS = [
  { value: '', label: 'Sin definir' },
  { value: 'easy', label: 'Facil' },
  { value: 'moderate', label: 'Moderado' },
  { value: 'challenging', label: 'Desafiante' },
]
const MAX_HERO_IMAGES = 5
const MAX_DOCUMENTS = 10

// === Types ===

interface TripData {
  id: string
  odooName: string
  odooListPriceCentavos: number
  odooCurrencyCode: string
  odooCategory: string
  odooDescriptionSale: string
  odooRatingCount: number
  odooRatingAvg: number
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
  documents: TripDocument[]
  odooDocuments: OdooDocument[]
  departures: DepartureData[]
}

interface DepartureData {
  id: string
  odooName: string
  startDate: { _seconds?: number; seconds?: number }
  endDate: { _seconds?: number; seconds?: number }
  seatsMax: number
  seatsAvailable: number
  isActive: boolean
  syncSource?: string
}

interface SaleOrder {
  orderId: number
  orderName: string
  state: string
  dateOrder: string
  amountTotal: number
  currencyCode: string
  invoiceStatus: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  customerCity: string | null
  agentName: string | null
  paymentState: 'paid' | 'partial' | 'not_paid' | 'in_payment' | null
  amountPaid: number
  amountResidual: number
}

interface SalesData {
  orders: SaleOrder[]
  summary: {
    totalOrders: number
    totalAmount: number
    totalPaid: number
    totalResidual: number
    byPaymentState: Record<string, number>
  }
}

// === Helpers ===

function timestampToDate(ts: unknown): Date | null {
  if (!ts || typeof ts !== 'object') return null
  const obj = ts as Record<string, unknown>
  const seconds = (obj.seconds ?? obj._seconds) as number | undefined
  return typeof seconds === 'number' ? new Date(seconds * 1000) : null
}

function formatPrice(centavos: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    maximumFractionDigits: 0,
  }).format(centavos / 100)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getDocIcon(mimetype: string): string {
  if (mimetype === 'application/pdf') return 'PDF'
  if (mimetype.startsWith('image/')) return 'IMG'
  return 'DOC'
}

const PAYMENT_STATE_LABELS: Record<string, { label: string; color: string }> = {
  paid: { label: 'Pagado', color: 'bg-green-100 text-green-800' },
  partial: { label: 'Parcial', color: 'bg-yellow-100 text-yellow-800' },
  not_paid: { label: 'Sin pago', color: 'bg-red-100 text-red-800' },
  in_payment: { label: 'En proceso', color: 'bg-blue-100 text-blue-800' },
}

function formatCurrency(amount: number, currency: string = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

function computeCompleteness(trip: TripData): number {
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

// === Component ===

export function TripEditPanel() {
  const params = useParams<{ tripId: string }>()
  const router = useRouter()
  const pathname = usePathname()
  const tripsBasePath = pathname?.startsWith('/superadmin')
    ? '/superadmin/trips'
    : pathname?.startsWith('/director')
      ? '/director/trips'
      : '/admin/trips'
  const tripId = params.tripId

  const [trip, setTrip] = useState<TripData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUnpublishDialog, setShowUnpublishDialog] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Sales data (on-demand from Odoo)
  const [sales, setSales] = useState<SalesData | null>(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError] = useState<string | null>(null)

  // New departure form
  const [showNewDeparture, setShowNewDeparture] = useState(false)
  const [newDepName, setNewDepName] = useState('')
  const [newDepStart, setNewDepStart] = useState('')
  const [newDepEnd, setNewDepEnd] = useState('')
  const [newDepSeats, setNewDepSeats] = useState('30')
  const [isCreatingDep, setIsCreatingDep] = useState(false)

  const { save } = useAutoSave<Record<string, unknown>>({
    endpoint: `/api/trips/${tripId}`,
  })

  // Fetch trip data
  const fetchTrip = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/trips/${tripId}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Error al cargar viaje')
      }
      const data = await res.json()
      // Normalize: Firestore docs may not have editorial fields
      setTrip({
        ...data,
        slug: data.slug ?? '',
        emotionalCopy: data.emotionalCopy ?? '',
        tags: data.tags ?? [],
        highlights: data.highlights ?? [],
        difficulty: data.difficulty ?? null,
        seoTitle: data.seoTitle ?? '',
        seoDescription: data.seoDescription ?? '',
        heroImages: data.heroImages ?? [],
        documents: data.documents ?? [],
        odooDocuments: data.odooDocuments ?? [],
        departures: data.departures ?? [],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    fetchTrip()
  }, [fetchTrip])

  // Auto-save editorial field
  const handleEditorialChange = useCallback((field: string, value: unknown) => {
    if (!trip) return
    const updated = { ...trip, [field]: value }
    setTrip(updated)
    save({ [field]: value })
  }, [trip, save])

  // Publish toggle
  const handlePublishToggle = useCallback(() => {
    if (!trip) return
    if (trip.isPublished) {
      setShowUnpublishDialog(true)
    } else {
      handleEditorialChange('isPublished', true)
    }
  }, [trip, handleEditorialChange])

  const confirmUnpublish = useCallback(() => {
    handleEditorialChange('isPublished', false)
    setShowUnpublishDialog(false)
  }, [handleEditorialChange])

  // Hero image upload
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !trip) return
    e.target.value = '' // Reset input

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/trips/${tripId}/images`, { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Error al subir imagen')
      }
      const { url } = await res.json()
      setTrip({ ...trip, heroImages: [...trip.heroImages, url] })
      toast.success('Imagen subida')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir imagen')
    } finally {
      setIsUploading(false)
    }
  }, [trip, tripId])

  // Hero image delete
  const handleImageDelete = useCallback(async (url: string) => {
    if (!trip) return
    const filename = url.split('/').pop()?.split('?')[0]
    if (!filename) return

    try {
      const res = await fetch(`/api/trips/${tripId}/images/${filename}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Error al eliminar imagen')
      }
      setTrip({ ...trip, heroImages: trip.heroImages.filter((u) => u !== url) })
      toast.success('Imagen eliminada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar imagen')
    }
  }, [trip, tripId])

  // Document upload
  const handleDocUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !trip) return
    e.target.value = ''

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name.replace(/\.pdf$/i, ''))
      const res = await fetch(`/api/trips/${tripId}/documents`, { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Error al subir documento')
      }
      const doc = await res.json()
      setTrip({ ...trip, documents: [...trip.documents, doc] })
      toast.success('Documento subido')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir documento')
    } finally {
      setIsUploading(false)
    }
  }, [trip, tripId])

  // Document delete
  const handleDocDelete = useCallback(async (docId: string) => {
    if (!trip) return
    try {
      const res = await fetch(`/api/trips/${tripId}/documents/${docId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Error al eliminar documento')
      }
      setTrip({ ...trip, documents: trip.documents.filter((d) => d.id !== docId) })
      toast.success('Documento eliminado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar documento')
    }
  }, [trip, tripId])

  // Create departure
  const handleCreateDeparture = useCallback(async () => {
    if (!trip) return
    setIsCreatingDep(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/departures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDepName,
          startDate: new Date(newDepStart).toISOString(),
          endDate: new Date(newDepEnd).toISOString(),
          seatsMax: parseInt(newDepSeats, 10),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Error al crear salida')
      }
      toast.success('Salida creada')
      setShowNewDeparture(false)
      setNewDepName('')
      setNewDepStart('')
      setNewDepEnd('')
      setNewDepSeats('30')
      fetchTrip() // Refresh
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear salida')
    } finally {
      setIsCreatingDep(false)
    }
  }, [trip, tripId, newDepName, newDepStart, newDepEnd, newDepSeats, fetchTrip])

  // Toggle departure active
  const handleToggleDepartureActive = useCallback(async (depId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/departures/${depId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Error al actualizar salida')
      }
      toast.success(isActive ? 'Salida activada' : 'Salida desactivada')
      fetchTrip()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }, [tripId, fetchTrip])

  // Slug auto-generation
  const handleSlugGenerate = useCallback(() => {
    if (!trip) return
    const slug = generateSlug(trip.odooName)
    handleEditorialChange('slug', slug)
  }, [trip, handleEditorialChange])

  // Fetch sales from Odoo (on-demand)
  const fetchSales = useCallback(async () => {
    setSalesLoading(true)
    setSalesError(null)
    try {
      const res = await fetch(`/api/trips/${tripId}/sales`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Error al cargar ventas')
      }
      const data = await res.json()
      setSales(data)
    } catch (err) {
      setSalesError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSalesLoading(false)
    }
  }, [tripId])

  // Auto-fetch sales when trip loads (only once per tripId, NOT on trip state changes)
  useEffect(() => {
    fetchSales()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  // === Loading state ===
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    )
  }

  // === Error state ===
  if (error || !trip) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push(tripsBasePath)}>
          &larr; Volver a Viajes
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
          <p className="text-destructive">{error ?? 'Viaje no encontrado'}</p>
          <Button variant="outline" className="mt-4" onClick={fetchTrip}>Reintentar</Button>
        </div>
      </div>
    )
  }

  const completeness = computeCompleteness(trip)
  const completenessPercent = Math.round((completeness / EDITORIAL_FIELDS.length) * 100)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => router.push(tripsBasePath)}>
            &larr; Volver a Viajes
          </Button>
          <h1 className="font-heading text-xl font-semibold">{trip.odooName}</h1>
          <p className="text-sm text-muted-foreground">
            {formatPrice(trip.odooListPriceCentavos, trip.odooCurrencyCode)}
            {trip.odooCategory && ` · ${trip.odooCategory}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="publish-toggle" className="text-sm">
            {trip.isPublished ? 'Publicado' : 'Borrador'}
          </Label>
          <Switch
            id="publish-toggle"
            checked={trip.isPublished}
            onCheckedChange={handlePublishToggle}
          />
        </div>
      </div>

      {/* Editorial completeness */}
      {completeness < EDITORIAL_FIELDS.length && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">
                {completeness === 0
                  ? 'Este viaje necesita tu toque creativo'
                  : `${completeness}/${EDITORIAL_FIELDS.length} campos completados`}
              </p>
              <span className="text-xs text-muted-foreground">{completenessPercent}%</span>
            </div>
            <Progress value={completenessPercent} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Info Basica */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Info Basica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <div className="flex gap-2">
                  <Input
                    id="slug"
                    value={trip.slug}
                    onChange={(e) => handleEditorialChange('slug', e.target.value.toLowerCase())}
                    placeholder="vuelta-al-mundo-2026"
                  />
                  <Button variant="outline" size="sm" onClick={handleSlugGenerate}>
                    Auto
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emotionalCopy">Copy Emocional</Label>
                <textarea
                  id="emotionalCopy"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={trip.emotionalCopy}
                  onChange={(e) => handleEditorialChange('emotionalCopy', e.target.value)}
                  placeholder="Describe la experiencia emocional de este viaje..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="difficulty">Dificultad</Label>
                <Select
                  value={trip.difficulty ?? ''}
                  onValueChange={(v) => handleEditorialChange('difficulty', v === '_null' ? null : v)}
                >
                  <SelectTrigger id="difficulty">
                    <SelectValue placeholder="Seleccionar dificultad" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value || '_null'}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Hero Images */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Imagenes Hero</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {trip.heroImages.map((url, i) => (
                  <div key={url} className="group relative aspect-video overflow-hidden rounded-lg border">
                    <Image src={url} alt={`Hero ${i + 1}`} fill className="object-cover" sizes="(max-width: 640px) 50vw, 33vw" />
                    {i === 0 && (
                      <Badge className="absolute left-2 top-2" variant="default">Principal</Badge>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleImageDelete(url)}
                    >
                      Eliminar
                    </Button>
                  </div>
                ))}
              </div>
              {trip.heroImages.length < MAX_HERO_IMAGES && (
                <div>
                  <Label htmlFor="hero-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-sm text-muted-foreground hover:border-muted-foreground/50 transition-colors">
                      {isUploading ? 'Subiendo...' : `Subir imagen (${trip.heroImages.length}/${MAX_HERO_IMAGES})`}
                    </div>
                  </Label>
                  <input
                    id="hero-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seoTitle">Titulo SEO (max 70)</Label>
                <Input
                  id="seoTitle"
                  value={trip.seoTitle}
                  onChange={(e) => handleEditorialChange('seoTitle', e.target.value)}
                  maxLength={70}
                  placeholder="Vuelta al Mundo 2026 - AroundaPlanet"
                />
                <p className="text-xs text-muted-foreground">{trip.seoTitle.length}/70</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoDescription">Descripcion SEO (max 160)</Label>
                <textarea
                  id="seoDescription"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={trip.seoDescription}
                  onChange={(e) => handleEditorialChange('seoDescription', e.target.value)}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground">{trip.seoDescription.length}/160</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (separados por coma)</Label>
                <Input
                  id="tags"
                  value={trip.tags.join(', ')}
                  onChange={(e) => {
                    const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
                    handleEditorialChange('tags', tags)
                  }}
                  placeholder="aventura, premium, lujo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="highlights">Highlights (separados por coma)</Label>
                <Input
                  id="highlights"
                  value={trip.highlights.join(', ')}
                  onChange={(e) => {
                    const hl = e.target.value.split(',').map((h) => h.trim()).filter(Boolean)
                    handleEditorialChange('highlights', hl)
                  }}
                  placeholder="33 dias, 15 paises, todo incluido"
                />
              </div>
            </CardContent>
          </Card>

          {/* Departures */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Salidas</CardTitle>
              <Button size="sm" onClick={() => setShowNewDeparture(true)}>
                Nueva salida
              </Button>
            </CardHeader>
            <CardContent>
              {trip.departures.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No hay salidas. Crea una manualmente o sincroniza desde Odoo.
                </p>
              ) : (
                <div className="space-y-3">
                  {trip.departures.map((dep) => {
                    const start = timestampToDate(dep.startDate)
                    const end = timestampToDate(dep.endDate)
                    return (
                      <div key={dep.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{dep.odooName}</p>
                            {dep.syncSource === 'odoo' && <Badge variant="outline">Odoo</Badge>}
                            {!dep.isActive && <Badge variant="secondary">Inactiva</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {start?.toLocaleDateString('es-MX') ?? '?'} — {end?.toLocaleDateString('es-MX') ?? '?'}
                            {' · '}{dep.seatsAvailable}/{dep.seatsMax} asientos
                          </p>
                        </div>
                        <Switch
                          checked={dep.isActive}
                          onCheckedChange={(v) => handleToggleDepartureActive(dep.id, v)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}

              {/* New departure form */}
              {showNewDeparture && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Nueva Salida Manual</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="dep-name">Nombre</Label>
                        <Input id="dep-name" value={newDepName} onChange={(e) => setNewDepName(e.target.value)} placeholder="Salida Marzo 2026" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="dep-seats">Asientos max</Label>
                        <Input id="dep-seats" type="number" value={newDepSeats} onChange={(e) => setNewDepSeats(e.target.value)} min="1" max="1000" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="dep-start">Fecha inicio</Label>
                        <Input id="dep-start" type="date" value={newDepStart} onChange={(e) => setNewDepStart(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="dep-end">Fecha fin</Label>
                        <Input id="dep-end" type="date" value={newDepEnd} onChange={(e) => setNewDepEnd(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCreateDeparture} disabled={isCreatingDep || !newDepName || !newDepStart || !newDepEnd}>
                        {isCreatingDep ? 'Creando...' : 'Crear'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowNewDeparture(false)}>Cancelar</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Sales */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                Ventas
                <Badge variant="outline" className="text-xs font-normal">Odoo en vivo</Badge>
              </CardTitle>
              {sales && (
                <Button size="sm" variant="ghost" onClick={fetchSales} disabled={salesLoading}>
                  {salesLoading ? 'Cargando...' : 'Actualizar'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {salesLoading && !sales && (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )}

              {salesError && (
                <div className="rounded border border-destructive/50 bg-destructive/5 p-4 text-center">
                  <p className="text-sm text-destructive">{salesError}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={fetchSales}>Reintentar</Button>
                </div>
              )}

              {sales && sales.summary?.totalOrders === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No hay ventas confirmadas para este viaje.
                </p>
              )}

              {sales && sales.summary?.totalOrders > 0 && (
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-lg font-bold">{sales.summary?.totalOrders}</p>
                      <p className="text-[10px] text-muted-foreground">Ordenes</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-lg font-bold">{formatCurrency(sales.summary?.totalAmount)}</p>
                      <p className="text-[10px] text-muted-foreground">Facturado</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-lg font-bold text-green-700">{formatCurrency(sales.summary?.totalPaid)}</p>
                      <p className="text-[10px] text-muted-foreground">Cobrado</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className={`text-lg font-bold ${sales.summary?.totalResidual > 0 ? 'text-amber-600' : 'text-green-700'}`}>
                        {formatCurrency(sales.summary?.totalResidual)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Pendiente</p>
                    </div>
                  </div>

                  {/* Payment state distribution */}
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(sales.summary?.byPaymentState).map(([state, count]) => {
                      const info = PAYMENT_STATE_LABELS[state] ?? { label: state, color: 'bg-gray-100 text-gray-800' }
                      return (
                        <span key={state} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${info.color}`}>
                          {info.label}: {count}
                        </span>
                      )
                    })}
                  </div>

                  <Separator />

                  {/* Orders table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="pb-2 pr-3">Orden</th>
                          <th className="pb-2 pr-3">Cliente</th>
                          <th className="pb-2 pr-3">Agente</th>
                          <th className="pb-2 pr-3 text-right">Total</th>
                          <th className="pb-2 pr-3 text-right">Pagado</th>
                          <th className="pb-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.orders.map((order) => {
                          const ps = PAYMENT_STATE_LABELS[order.paymentState ?? ''] ?? { label: '—', color: 'bg-gray-100 text-gray-800' }
                          const orderDate = new Date(order.dateOrder)
                          return (
                            <tr key={order.orderId} className="border-b last:border-0">
                              <td className="py-2 pr-3">
                                <p className="font-medium">{order.orderName}</p>
                                <p className="text-[10px] text-muted-foreground">{orderDate.toLocaleDateString('es-MX')}</p>
                              </td>
                              <td className="py-2 pr-3">
                                <p className="truncate max-w-[140px]">{order.customerName}</p>
                                {order.customerCity && (
                                  <p className="text-[10px] text-muted-foreground">{order.customerCity}</p>
                                )}
                              </td>
                              <td className="py-2 pr-3">
                                <p className="text-xs truncate max-w-[120px]">{order.agentName ?? '—'}</p>
                              </td>
                              <td className="py-2 pr-3 text-right tabular-nums">
                                {formatCurrency(order.amountTotal, order.currencyCode)}
                              </td>
                              <td className="py-2 pr-3 text-right tabular-nums">
                                {formatCurrency(order.amountPaid, order.currencyCode)}
                              </td>
                              <td className="py-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ps.color}`}>
                                  {ps.label}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Odoo Info (read-only) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Datos Odoo
                <Badge variant="outline" className="text-xs font-normal">Solo lectura</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Nombre</p>
                <p className="font-medium">{trip.odooName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Precio</p>
                <p className="font-medium">{formatPrice(trip.odooListPriceCentavos, trip.odooCurrencyCode)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Categoria</p>
                <p className="font-medium">{trip.odooCategory || '—'}</p>
              </div>
              {trip.odooDescriptionSale && (
                <div>
                  <p className="text-muted-foreground">Descripcion</p>
                  <p className="text-xs">{trip.odooDescriptionSale}</p>
                </div>
              )}
              {trip.odooRatingCount > 0 && (
                <div>
                  <p className="text-muted-foreground">Rating</p>
                  <p className="font-medium">{trip.odooRatingAvg.toFixed(1)} ({trip.odooRatingCount})</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Odoo documents (read-only, synced) */}
              {trip.odooDocuments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Desde Odoo</p>
                  {trip.odooDocuments.map((doc) => (
                    <a
                      key={doc.odooAttachmentId}
                      href={`/api/odoo/documents/${doc.odooAttachmentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded border p-2 hover:bg-muted/50 transition-colors"
                    >
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        doc.mimetype === 'application/pdf'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {getDocIcon(doc.mimetype)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{doc.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatFileSize(doc.fileSize)}
                          {doc.shownOnProductPage && ' · Publico'}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {/* Uploaded documents (editable) */}
              {trip.documents.length > 0 && (
                <div className="space-y-2">
                  {trip.odooDocuments.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subidos</p>
                  )}
                  {trip.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded border p-2">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline truncate max-w-[150px]"
                      >
                        {doc.name}
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDocDelete(doc.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload */}
              {trip.documents.length < MAX_DOCUMENTS && (
                <div>
                  <Label htmlFor="doc-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center rounded border-2 border-dashed border-muted-foreground/25 p-4 text-xs text-muted-foreground hover:border-muted-foreground/50 transition-colors">
                      {isUploading ? 'Subiendo...' : `Subir PDF (${trip.documents.length}/${MAX_DOCUMENTS})`}
                    </div>
                  </Label>
                  <input
                    id="doc-upload"
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleDocUpload}
                    disabled={isUploading}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Unpublish confirmation dialog */}
      <Dialog open={showUnpublishDialog} onOpenChange={setShowUnpublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Despublicar viaje</DialogTitle>
            <DialogDescription>
              Este viaje dejara de aparecer en el catalogo publico. Los clientes ya no podran verlo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnpublishDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmUnpublish}>Despublicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
