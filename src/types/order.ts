import type { OrderStatus } from '@/schemas/orderSchema'
export type { OrderStatus }

export interface Order {
  id: string
  userId: string | null
  guestToken: string | null
  agentId: string | null
  tripId: string
  departureId: string
  status: OrderStatus
  contactName: string
  contactPhone: string
  amountTotalCents: number
  amountPaidCents: number
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  createdAt: unknown // Firestore Timestamp
  updatedAt: unknown // Firestore Timestamp
}

export interface CreateOrderRequest {
  tripId: string
  departureId: string
  contactName: string
  contactPhone: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  agentId?: string
}

export interface CreateOrderResponse {
  orderId: string
  status: OrderStatus
  tripId: string
  departureId: string
  amountTotalCents: number
  guestToken: string | null
}
