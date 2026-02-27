import { z } from 'zod'
import { ALL_CATEGORY_KEYS } from '@/config/notifications'

const TIME_HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

export const categoriesSchema = z.record(
  z.string().refine(
    (key) => (ALL_CATEGORY_KEYS as readonly string[]).includes(key),
    'Categoria de notificacion invalida'
  ),
  z.boolean()
)

export const quietHoursSchema = z.object({
  enabled: z.boolean(),
  startTime: z.string().regex(TIME_HH_MM_REGEX, 'Formato esperado: HH:mm'),
  endTime: z.string().regex(TIME_HH_MM_REGEX, 'Formato esperado: HH:mm'),
})

export const channelsSchema = z.object({
  push: z.boolean(),
  whatsapp: z.boolean(),
  email: z.boolean(),
})

export const notificationPreferencesSchema = z.object({
  categories: categoriesSchema.optional(),
  quietHours: quietHoursSchema.optional(),
  channels: channelsSchema.optional(),
  timezone: z.string().min(1).optional(),
})

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>
