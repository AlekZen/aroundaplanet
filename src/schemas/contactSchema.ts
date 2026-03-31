import { z } from 'zod'
import type { Timestamp } from 'firebase-admin/firestore'

/** Schema for POST /api/agent-contacts — what the client sends */
export const createContactSchema = z.object({
  name: z.string().min(2, 'Nombre es requerido (mínimo 2 caracteres)').max(200),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  mobile: z.string().max(30).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
})

export type CreateContactFormData = z.infer<typeof createContactSchema>

/** Firestore document shape for agentContacts/{contactId} */
export type AgentContact = {
  id: string
  agentId: string
  name: string
  email: string | null
  phone: string | null
  mobile: string | null
  city: string | null
  source: 'platform'
  odooPartnerId: number | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Discriminated union for merged Odoo + platform clients */
export type UnifiedClient = {
  id: string
  name: string
  email: string | null
  phone: string | null
  city: string | null
  source: 'odoo' | 'platform'
  orderCount: number
  totalAmount: number // en MXN (no centavos) para display
  orders: UnifiedOrder[]
}

/** Unified order representation for both sources */
export type UnifiedOrder = {
  orderId: string
  orderName: string
  amountTotal: number
  dateOrder: string | null
  source: 'odoo' | 'platform'
  // Odoo-specific
  paymentState?: string | null
  amountResidual?: number
  // Platform-specific
  status?: string
  amountPaidCents?: number
  amountTotalCents?: number
}
