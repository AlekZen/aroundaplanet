import { z } from 'zod'
import { VALID_ROLES } from '@/config/roles'

export const USER_LIST_PAGE_SIZE = 20

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(USER_LIST_PAGE_SIZE),
  search: z.string().trim().max(200).optional(),
  roleFilter: z.enum(VALID_ROLES).optional(),
  statusFilter: z.enum(['active', 'inactive']).optional(),
  cursor: z.string().optional(),
})

export type UserListQuery = z.infer<typeof userListQuerySchema>

export const userStatusUpdateSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(500).optional(),
})

export type UserStatusUpdate = z.infer<typeof userStatusUpdateSchema>

export const odooSyncResultSchema = z.object({
  total: z.number().int().min(0),
  created: z.number().int().min(0),
  updated: z.number().int().min(0),
  errors: z.number().int().min(0),
  syncedAt: z.string(),
  isStale: z.boolean(),
})

export type OdooSyncResult = z.infer<typeof odooSyncResultSchema>
