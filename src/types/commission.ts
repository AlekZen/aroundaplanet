import type { Timestamp } from 'firebase-admin/firestore'
import type { CommissionStatus } from '@/schemas/commissionSchema'

export interface Commission {
  id: string
  paymentId: string
  orderId: string
  agentId: string
  clientName: string
  tripName: string
  paymentAmountCents: number
  commissionRate: number
  commissionAmountCents: number
  status: CommissionStatus
  period: string // YYYY-MM
  createdAt: Timestamp
  updatedAt: Timestamp
  approvedBy: string | null
  approvedAt: Timestamp | null
  paidAt: Timestamp | null
}

export interface AgentMetrics {
  verifiedSalesCents: number
  activeClients: number
  pendingCommissionsCents: number
  earnedCommissionsCents: number
}
