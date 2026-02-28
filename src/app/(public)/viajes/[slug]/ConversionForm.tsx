'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { trackEvent } from '@/lib/analytics'
import { PHONE_COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from '@/schemas/orderSchema'
import { WHATSAPP_CONTACT_NUMBER, buildWhatsAppUrl } from '@/config/whatsapp'
import type { PublicDeparture } from '@/types/trip'
import type { CreateOrderResponse } from '@/types/order'

interface ConversionFormProps {
  isOpen: boolean
  onClose: () => void
  tripId: string
  tripName: string
  tripSlug: string
  tripPrice: number
  departures: PublicDeparture[]
  selectedDepartureId: string | null
  isAuthenticated: boolean
  attributionData: {
    utmSource?: string
    utmMedium?: string
    utmCampaign?: string
    agentId?: string
  }
}

function formatPrice(centavos: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(centavos / 100)
}

function formatDepartureOption(dep: PublicDeparture): string {
  const date = new Date(dep.startDate).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return `${date} — ${dep.seatsAvailable} lugares`
}

const MIN_PHONE_DIGITS = 7

export function ConversionForm({
  isOpen,
  onClose,
  tripId,
  tripName,
  tripSlug,
  tripPrice,
  departures,
  selectedDepartureId,
  isAuthenticated,
  attributionData,
}: ConversionFormProps) {
  const availableDepartures = departures.filter((d) => d.seatsAvailable > 0)
  const [departureId, setDepartureId] = useState<string>(selectedDepartureId ?? '')
  const [contactName, setContactName] = useState('')
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [touchedName, setTouchedName] = useState(false)
  const [touchedPhone, setTouchedPhone] = useState(false)
  const [formStep, setFormStep] = useState<'form' | 'success'>('form')

  // Sync preselection when prop changes
  if (selectedDepartureId && selectedDepartureId !== departureId && !isSubmitting) {
    setDepartureId(selectedDepartureId)
  }

  const nameError = touchedName && contactName.trim().length < 2 ? 'Minimo 2 caracteres' : null
  const phoneError = touchedPhone && phoneNumber.trim().length < MIN_PHONE_DIGITS ? `Minimo ${MIN_PHONE_DIGITS} digitos` : null
  const isFormValid = contactName.trim().length >= 2 && phoneNumber.trim().length >= MIN_PHONE_DIGITS && !!departureId

  function handleClose() {
    setFormStep('form')
    setContactName('')
    setPhoneNumber('')
    setCountryCode(DEFAULT_COUNTRY_CODE)
    setTouchedName(false)
    setTouchedPhone(false)
    onClose()
  }

  async function handleSubmit() {
    setTouchedName(true)
    setTouchedPhone(true)
    if (!isFormValid) return

    setIsSubmitting(true)
    try {
      const contactPhone = `${countryCode}${phoneNumber.trim()}`

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          departureId,
          contactName: contactName.trim(),
          contactPhone,
          ...attributionData,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.message ?? 'Error al procesar la solicitud')
      }

      const data: CreateOrderResponse = await res.json()

      // Save guestToken for account linking (guests only)
      if (data.guestToken) {
        try {
          localStorage.setItem('guestOrderToken', data.guestToken)
        } catch {
          // localStorage unavailable — non-blocking
        }
      }

      trackEvent('generate_lead', {
        trip_id: data.tripId,
        agent_id: attributionData.agentId ?? 'sin_asignar',
        utm_source: attributionData.utmSource ?? 'direct',
        order_id: data.orderId,
      })

      toast.success('Tu cotizacion fue registrada')
      setFormStep('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No pudimos procesar tu solicitud — intenta de nuevo'
      toast.error(message, {
        duration: Infinity,
        action: {
          label: 'Reintentar',
          onClick: () => handleSubmit(),
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const successContent = (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Tu cotizacion fue registrada</h3>
        <p className="text-sm text-muted-foreground">Te contactaremos pronto por WhatsApp</p>
      </div>
      <div className="space-y-3">
        {!isAuthenticated && (
          <Button asChild className="h-12 w-full bg-primary text-lg font-semibold text-primary-foreground hover:bg-primary/90">
            <Link href={`/register?returnUrl=${encodeURIComponent(`/viajes/${tripSlug}`)}`}>
              Crear cuenta para dar seguimiento
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="h-12 w-full text-lg font-semibold">
          <a
            href={buildWhatsAppUrl(WHATSAPP_CONTACT_NUMBER, `Hola, cotice el viaje ${tripName}`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contactar por WhatsApp
          </a>
        </Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleClose}>
          Cerrar
        </Button>
      </div>
    </div>
  )

  const formContent = (
    <div className="space-y-5">
      {/* Trip summary */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="text-lg font-semibold text-foreground">{tripName}</h3>
        <p className="font-mono text-2xl font-bold text-primary">{formatPrice(tripPrice)}</p>
      </div>

      {/* Empty state: no departures */}
      {availableDepartures.length === 0 ? (
        <div className="space-y-3 text-center">
          <p className="text-muted-foreground">Sin salidas disponibles — contactanos</p>
          <Button asChild variant="outline" className="w-full">
            <a
              href={buildWhatsAppUrl(WHATSAPP_CONTACT_NUMBER)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Contactar por WhatsApp
            </a>
          </Button>
        </div>
      ) : (
        <>
          {/* Contact name */}
          <div className="space-y-1">
            <label htmlFor="contact-name" className="text-sm font-medium text-foreground">
              Nombre completo
            </label>
            <Input
              id="contact-name"
              placeholder="Tu nombre"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              onBlur={() => setTouchedName(true)}
              autoComplete="name"
              aria-invalid={!!nameError}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>

          {/* Phone with country code */}
          <div className="space-y-1">
            <label htmlFor="phone-number" className="text-sm font-medium text-foreground">
              WhatsApp / Telefono
            </label>
            <div className="flex gap-2">
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger className="w-[130px] shrink-0" aria-label="Codigo de pais">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHONE_COUNTRY_CODES.map((c) => (
                    <SelectItem key={`${c.short}-${c.code}`} value={c.code}>
                      {c.short} {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="phone-number"
                type="tel"
                placeholder="Numero de telefono"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d]/g, ''))}
                onBlur={() => setTouchedPhone(true)}
                autoComplete="tel-national"
                aria-invalid={!!phoneError}
              />
            </div>
            {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
          </div>

          {/* Departure selector */}
          <div className="space-y-2">
            <label htmlFor="departure-select" className="text-sm font-medium text-foreground">
              Fecha de salida
            </label>
            <Select value={departureId} onValueChange={setDepartureId}>
              <SelectTrigger id="departure-select">
                <SelectValue placeholder="Selecciona una fecha" />
              </SelectTrigger>
              <SelectContent>
                {availableDepartures.map((dep) => (
                  <SelectItem key={dep.id} value={dep.id}>
                    {formatDepartureOption(dep)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Submit CTA */}
          <Button
            className="h-12 w-full bg-accent text-lg font-semibold text-accent-foreground hover:bg-accent/90"
            disabled={!isFormValid || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Procesando...' : 'Confirmar Cotizacion'}
          </Button>

          {/* Legal text */}
          <p className="text-center text-xs text-muted-foreground">
            Al confirmar, aceptas nuestros{' '}
            <Link href="/terms" className="underline hover:text-foreground">
              Terminos y Condiciones
            </Link>{' '}
            y{' '}
            <Link href="/privacy" className="underline hover:text-foreground">
              Aviso de Privacidad
            </Link>
          </p>
        </>
      )}
    </div>
  )

  const content = formStep === 'form' ? formContent : successContent

  return (
    <>
      {/* Mobile: Sheet (slide-up) */}
      <div className="lg:hidden">
        <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>{formStep === 'form' ? 'Cotizar Viaje' : 'Cotizacion Enviada'}</SheetTitle>
              <SheetDescription>
                {formStep === 'form' ? 'Completa tus datos y selecciona una fecha' : 'Nos pondremos en contacto contigo'}
              </SheetDescription>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Dialog (centered) */}
      <div className="hidden lg:block">
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
          <DialogContent className="max-w-[440px]">
            <DialogHeader>
              <DialogTitle>{formStep === 'form' ? 'Cotizar Viaje' : 'Cotizacion Enviada'}</DialogTitle>
              <DialogDescription>
                {formStep === 'form' ? 'Completa tus datos y selecciona una fecha' : 'Nos pondremos en contacto contigo'}
              </DialogDescription>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
