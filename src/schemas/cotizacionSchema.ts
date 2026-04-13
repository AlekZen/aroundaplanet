import { z } from 'zod'

export const TIPOS_VIAJE = [
  'Nacional',
  'Internacional',
  'Crucero',
  'Paquete todo incluido',
  'Vuelo+Hotel',
  'Solo vuelo',
  'Solo hotel',
] as const

export const RANGOS_PRESUPUESTO = [
  '<$10K',
  '$10K-$25K',
  '$25K-$50K',
  '$50K-$100K',
  '>$100K',
  'Sin límite',
] as const

export const OPCIONES_ADULTOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 20, 25, 30] as const

export const OPCIONES_MENORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export const OPCIONES_HABITACIONES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

function isValidDate(val: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false
  const [year, month, day] = val.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function isPositiveInt(val: string): boolean {
  return /^\d+$/.test(val) && Number(val) >= 1
}

function isNonNegativeInt(val: string): boolean {
  return /^\d+$/.test(val) && Number(val) >= 0
}

export const cotizacionSchema = z
  .object({
    nombreAgente: z
      .string()
      .trim()
      .min(2, 'Nombre del asesor es requerido (mínimo 2 caracteres)'),
    nombreCliente: z
      .string()
      .trim()
      .min(2, 'Nombre del cliente es requerido (mínimo 2 caracteres)'),
    tipoViaje: z.enum(TIPOS_VIAJE, {
      error: 'Selecciona un tipo de viaje',
    }),
    destino: z
      .string()
      .trim()
      .min(2, 'Destino es requerido (mínimo 2 caracteres)'),
    fechaSalida: z.string().refine(isValidDate, 'Fecha de salida inválida'),
    fechaRegreso: z.string().refine(isValidDate, 'Fecha de regreso inválida'),
    adultos: z.string().refine(isPositiveInt, 'Mínimo 1 adulto'),
    menores: z.string().refine(isNonNegativeInt, 'Cantidad de menores inválida'),
    edadesMenores: z.string().optional(),
    habitaciones: z.string().refine(isPositiveInt, 'Mínimo 1 habitación'),
    presupuesto: z.enum(RANGOS_PRESUPUESTO, {
      error: 'Selecciona un rango de presupuesto',
    }),
    notas: z.string().max(300, 'Máximo 300 caracteres').optional(),
  })
  .superRefine((data, ctx) => {
    const menoresNum = Number(data.menores)
    if (menoresNum > 0) {
      if (!data.edadesMenores || data.edadesMenores.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Indica las edades de los menores (ej: 5, 8, 12)',
          path: ['edadesMenores'],
        })
      } else if (!/^\d+(\s*,\s*\d+)*$/.test(data.edadesMenores.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Formato inválido. Usa números separados por comas (ej: 5, 8, 12)',
          path: ['edadesMenores'],
        })
      } else {
        const edades = data.edadesMenores
          .trim()
          .split(',')
          .map((e) => Number(e.trim()))

        if (edades.length !== menoresNum) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Debes indicar ${menoresNum} ${menoresNum === 1 ? 'edad' : 'edades'} (una por cada menor)`,
            path: ['edadesMenores'],
          })
        } else if (edades.some((e) => e < 0 || e > 17)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Las edades de menores deben estar entre 0 y 17 años',
            path: ['edadesMenores'],
          })
        }
      }
    }

    if (
      isValidDate(data.fechaSalida) &&
      isValidDate(data.fechaRegreso) &&
      data.fechaRegreso < data.fechaSalida
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La fecha de regreso debe ser igual o posterior a la de salida',
        path: ['fechaRegreso'],
      })
    }
  })

export type CotizacionFormData = z.infer<typeof cotizacionSchema>
