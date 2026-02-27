import type { UserRole, NotificationPreferences } from '@/types/user'

export const NOTIFICATION_CATEGORIES = {
  payments: { label: 'Pagos', description: 'Pagos verificados, rechazados y reportados' },
  sales: { label: 'Nuevos Clientes', description: 'Nuevos leads y conversiones' },
  reports: { label: 'Resumenes', description: 'Resumenes diarios y semanales' },
  trips: { label: 'Viajes', description: 'Hitos y cambios en viajes' },
  alerts: { label: 'Alertas', description: 'Alertas de excepcion y urgentes' },
} as const

export type NotificationCategoryKey = keyof typeof NOTIFICATION_CATEGORIES

export const ALL_CATEGORY_KEYS = Object.keys(NOTIFICATION_CATEGORIES) as readonly NotificationCategoryKey[]

export const ROLE_NOTIFICATION_CATEGORIES: Record<UserRole, NotificationCategoryKey[]> = {
  cliente: ['payments', 'trips', 'alerts'],
  agente: ['payments', 'sales', 'reports', 'alerts'],
  admin: ['payments', 'reports', 'alerts'],
  director: ['reports', 'alerts'],
  superadmin: ['payments', 'sales', 'reports', 'trips', 'alerts'],
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  categories: {
    payments: true,
    sales: true,
    reports: true,
    trips: true,
    alerts: true,
  },
  quietHours: {
    enabled: true,
    startTime: '23:00',
    endTime: '07:00',
  },
  channels: {
    push: true,
    whatsapp: true,
    email: false,
  },
  timezone: 'America/Mexico_City',
}

/** Common timezone options for the UI select */
export const TIMEZONE_OPTIONS = [
  { value: 'America/Mexico_City', label: 'Ciudad de Mexico (CST)' },
  { value: 'America/Cancun', label: 'Cancun (EST)' },
  { value: 'America/Tijuana', label: 'Tijuana (PST)' },
  { value: 'America/Hermosillo', label: 'Hermosillo (MST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET)' },
  { value: 'UTC', label: 'UTC' },
] as const
