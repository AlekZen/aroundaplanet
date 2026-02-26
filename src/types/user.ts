import type { Timestamp } from 'firebase/firestore'

export type UserRole = 'cliente' | 'agente' | 'admin' | 'director' | 'superadmin'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  roles: UserRole[]
  isActive: boolean
  provider: 'email' | 'google'
  createdAt: Timestamp
  updatedAt: Timestamp
  lastLoginAt: Timestamp
}
