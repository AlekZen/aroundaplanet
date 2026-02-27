import type { Timestamp } from 'firebase/firestore'

export type UserRole = 'cliente' | 'agente' | 'admin' | 'director' | 'superadmin'

export interface UserClaims {
  roles: UserRole[]
  agentId?: string
  adminLevel?: number // Placeholder futuro — no funcional aun
}

export interface FiscalData {
  rfc: string
  razonSocial: string
  regimenFiscal: string
  domicilioFiscal: string
  usoCFDI: string
}

export interface BankData {
  banco: string
  numeroCuenta: string
  clabe: string
  titularCuenta: string
}

export interface NotificationPreferences {
  categories: Record<string, boolean>
  quietHours: {
    enabled: boolean
    startTime: string
    endTime: string
  }
  channels: {
    push: boolean
    whatsapp: boolean
    email: boolean
  }
  timezone: string
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  roles: UserRole[]
  agentId?: string
  isActive: boolean
  provider: 'email' | 'google'
  createdAt: Timestamp
  updatedAt: Timestamp
  lastLoginAt: Timestamp
  // Personal data (Story 1.7)
  firstName?: string
  lastName?: string
  phone?: string
  // Fiscal data (Story 1.7)
  fiscalData?: FiscalData
  // Bank data — agents only (Story 1.7)
  bankData?: BankData
  // Notification preferences (Story 1.7)
  notificationPreferences?: NotificationPreferences
  // Odoo sync fields (Story 1.6)
  odooPartnerId?: number
  odooTeamId?: number
  odooWriteDate?: string
  lastSyncAt?: Timestamp
  needsRegistration?: boolean
}

export type AuditAction =
  | 'user.rolesUpdated'
  | 'user.deactivated'
  | 'user.activated'
  | 'odoo.syncCompleted'

export interface AuditLogEntry {
  action: AuditAction
  targetUid: string
  performedBy: string
  timestamp: Timestamp
  details: Record<string, unknown>
}

export interface UserListResponse {
  users: UserProfile[]
  nextCursor: string | null
  total: number
}

export interface OdooSyncResult {
  total: number
  created: number
  updated: number
  errors: number
  syncedAt: string
  isStale: boolean
}
