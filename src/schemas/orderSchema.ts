import { z } from 'zod'

/** All valid order statuses */
export const ORDER_STATUSES = [
  'Interesado',
  'Confirmado',
  'En Progreso',
  'Completado',
  'Cancelado',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Valid state transitions map: currentStatus → allowed next statuses (type-safe) */
export const VALID_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  Interesado: ['Confirmado', 'Cancelado'],
  Confirmado: ['En Progreso', 'Cancelado'],
  'En Progreso': ['Completado'],
  Completado: [],
  Cancelado: [],
}

export const orderStatusSchema = z.enum(ORDER_STATUSES)

/** Country dial codes for phone selector (Spanish-speaking countries) */
export const PHONE_COUNTRY_CODES = [
  { code: '+52', country: 'Mexico', short: 'MX' },
  { code: '+34', country: 'Espana', short: 'ES' },
  { code: '+54', country: 'Argentina', short: 'AR' },
  { code: '+591', country: 'Bolivia', short: 'BO' },
  { code: '+56', country: 'Chile', short: 'CL' },
  { code: '+57', country: 'Colombia', short: 'CO' },
  { code: '+506', country: 'Costa Rica', short: 'CR' },
  { code: '+53', country: 'Cuba', short: 'CU' },
  { code: '+593', country: 'Ecuador', short: 'EC' },
  { code: '+503', country: 'El Salvador', short: 'SV' },
  { code: '+502', country: 'Guatemala', short: 'GT' },
  { code: '+504', country: 'Honduras', short: 'HN' },
  { code: '+505', country: 'Nicaragua', short: 'NI' },
  { code: '+507', country: 'Panama', short: 'PA' },
  { code: '+595', country: 'Paraguay', short: 'PY' },
  { code: '+51', country: 'Peru', short: 'PE' },
  { code: '+1', country: 'Estados Unidos', short: 'US' },
  { code: '+1', country: 'Rep. Dominicana', short: 'DO' },
  { code: '+598', country: 'Uruguay', short: 'UY' },
  { code: '+58', country: 'Venezuela', short: 'VE' },
] as const

export const DEFAULT_COUNTRY_CODE = '+52'

/** Schema for POST /api/orders — what the client sends */
export const createOrderSchema = z.object({
  tripId: z.string().min(1, 'tripId es requerido'),
  departureId: z.string().min(1, 'departureId es requerido'),
  contactName: z.string().min(2, 'Nombre es requerido (minimo 2 caracteres)'),
  contactPhone: z.string().min(10, 'Telefono completo es requerido'),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  agentId: z.string().max(128).optional(),
})

export type CreateOrderFormData = z.infer<typeof createOrderSchema>
