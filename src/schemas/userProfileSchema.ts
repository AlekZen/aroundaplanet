import { z } from 'zod'

export const userProfileSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  photoURL: z.string().nullable(),
  roles: z.array(z.enum(['cliente', 'agente', 'admin', 'director', 'superadmin'])),
  isActive: z.boolean(),
  provider: z.enum(['email', 'google']),
  createdAt: z.any(),
  updatedAt: z.any(),
  lastLoginAt: z.any(),
})
