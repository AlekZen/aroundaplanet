'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  cotizacionSchema,
  TIPOS_VIAJE,
  RANGOS_PRESUPUESTO,
  OPCIONES_ADULTOS,
  OPCIONES_MENORES,
  OPCIONES_HABITACIONES,
  type CotizacionFormData,
} from '@/schemas/cotizacionSchema'
import { buildCotizacionMessage } from './cotizacionMessage'
import { buildWhatsAppUrl, WHATSAPP_COTIZACION_NUMBER } from '@/config/whatsapp'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function CotizacionForm() {
  const [waUrl, setWaUrl] = useState<string | null>(null)
  const [preview, setPreview] = useState<string>('')

  const form = useForm<CotizacionFormData>({
    resolver: zodResolver(cotizacionSchema),
    defaultValues: {
      nombreAgente: '',
      nombreCliente: '',
      tipoViaje: '' as CotizacionFormData['tipoViaje'],
      destino: '',
      fechaSalida: '',
      fechaRegreso: '',
      adultos: '2',
      menores: '0',
      edadesMenores: '',
      habitaciones: '1',
      presupuesto: '' as CotizacionFormData['presupuesto'],
      notas: '',
    },
  })

  const menores = form.watch('menores')
  const notas = form.watch('notas')

  function onSubmit(data: CotizacionFormData) {
    const message = buildCotizacionMessage(data)
    const url = buildWhatsAppUrl(WHATSAPP_COTIZACION_NUMBER, message)
    setPreview(message)
    setWaUrl(url)
  }

  function handleEdit() {
    setWaUrl(null)
    setPreview('')
  }

  if (waUrl) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-primary">Vista previa del mensaje</h2>
        <div className="rounded-lg bg-muted p-4">
          <pre className="whitespace-pre-wrap text-sm font-sans">{preview}</pre>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-md bg-[#25D366] px-6 text-sm font-medium text-white shadow hover:bg-[#20bd5a] transition-colors"
          >
            Abrir WhatsApp
          </a>
          <Button type="button" variant="outline" onClick={handleEdit}>
            Editar cotización
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Sección 1: Datos del asesor y cliente */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-primary">Datos del asesor y cliente</legend>
          <FormField
            control={form.control}
            name="nombreAgente"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del asesor</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: María López" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nombreCliente"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del cliente</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Juan Pérez García" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        {/* Sección 2: Detalles del viaje */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-primary">Detalles del viaje</legend>
          <FormField
            control={form.control}
            name="tipoViaje"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de viaje</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TIPOS_VIAJE.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="destino"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Destino</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Cancún, México" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="fechaSalida"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de salida</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fechaRegreso"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de regreso</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        {/* Sección 3: Pasajeros y hospedaje */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-primary">Pasajeros y hospedaje</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="adultos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adultos</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OPCIONES_ADULTOS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="menores"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Menores</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value)
                      // Reset edadesMenores cuando menores cambia a 0 (evita data stale)
                      if (value === '0') {
                        form.setValue('edadesMenores', '')
                      }
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OPCIONES_MENORES.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="habitaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Habitaciones</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OPCIONES_HABITACIONES.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {Number(menores) > 0 && (
            <FormField
              control={form.control}
              name="edadesMenores"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Edades de menores</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 5, 8, 12" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </fieldset>

        {/* Sección 4: Presupuesto y observaciones */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-primary">Presupuesto y observaciones</legend>
          <FormField
            control={form.control}
            name="presupuesto"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Presupuesto</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona un rango" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {RANGOS_PRESUPUESTO.map((rango) => (
                      <SelectItem key={rango} value={rango}>
                        {rango} MXN
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notas"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notas adicionales</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Preferencias, requerimientos especiales..."
                    maxLength={300}
                    {...field}
                  />
                </FormControl>
                <div className="text-xs text-muted-foreground text-right">
                  {notas?.length ?? 0}/300
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          Enviar por WhatsApp
        </Button>
      </form>
    </Form>
  )
}
