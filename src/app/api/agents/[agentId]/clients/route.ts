import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { getOdooClient } from '@/lib/odoo/client'
import { withCacheFallback } from '@/lib/odoo/cache'
import type { OdooRecord } from '@/types/odoo'

export interface AgentClient {
  partnerId: number
  name: string
  email: string | null
  phone: string | null
  city: string | null
  /** Number of confirmed orders for this client with this agent */
  orderCount: number
  /** Total amount across all orders (MXN, NOT centavos — raw from Odoo) */
  totalAmount: number
  /** Most recent order date */
  lastOrderDate: string | null
  /** Payment state of the most recent invoice */
  latestPaymentState: 'paid' | 'partial' | 'not_paid' | 'in_payment' | null
  /** Total paid across all invoices */
  totalPaid: number
  /** Total residual (pending) across all invoices */
  totalResidual: number
  /** List of orders for this client */
  orders: AgentClientOrder[]
}

export interface AgentClientOrder {
  orderId: number
  orderName: string
  dateOrder: string
  amountTotal: number
  invoiceStatus: string
  paymentState: 'paid' | 'partial' | 'not_paid' | 'in_payment' | null
  amountPaid: number
  amountResidual: number
}

export interface AgentClientsResponse {
  clients: AgentClient[]
  summary: {
    totalClients: number
    totalOrders: number
    totalAmount: number
    totalPaid: number
    totalResidual: number
  }
  agentName: string | null
  odooTeamId: number | null
}

const ORDER_FIELDS = [
  'name', 'state', 'date_order', 'amount_total', 'invoice_status',
  'invoice_ids', 'partner_id', 'team_id', 'currency_id',
] as const

const INVOICE_FIELDS = [
  'payment_state', 'amount_total', 'amount_residual',
] as const

const PARTNER_FIELDS = [
  'name', 'email', 'phone', 'mobile', 'city',
] as const

/**
 * GET /api/agents/[agentId]/clients
 *
 * Returns the agent's clients from Odoo, grouped by partner.
 * Agent isolation: agent can only see their own clients.
 * Admin/Director/SuperAdmin can see any agent's clients.
 *
 * Flow:
 * 1. Find the user with this agentId → get odooTeamId
 * 2. Query Odoo sale.order where team_id = odooTeamId
 * 3. Group by partner_id → unique clients
 * 4. Fetch partner details + invoice payment info
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const claims = await requireAuth()
    const { agentId } = await params

    // Agent isolation: agent can ONLY see their own clients.
    // Admin/Director/SuperAdmin can see any agent's clients.
    const isPrivileged = claims.roles.some(r =>
      r === 'admin' || r === 'director' || r === 'superadmin'
    )

    if (!isPrivileged && claims.agentId !== agentId) {
      throw new AppError(
        'INSUFFICIENT_PERMISSION',
        'Solo puedes ver tus propios clientes',
        403,
        false
      )
    }

    // Special case: SuperAdmin can query by odoo team ID directly (for unlinked agents)
    // Format: "odoo-team-{teamId}"
    const odooTeamMatch = agentId.match(/^odoo-team-(\d+)$/)
    if (odooTeamMatch && isPrivileged) {
      const teamId = Number(odooTeamMatch[1])
      // Look up agent name from odooAgents collection
      const agentDoc = await adminDb.collection('odooAgents').doc(String(teamId)).get()
      const agentName = agentDoc.exists ? (agentDoc.data()?.name as string) ?? null : null
      return await fetchAndReturnClients(teamId, agentName)
    }

    // Step 1: Find the user's odooTeamId
    const usersSnap = await adminDb
      .collection('users')
      .where('agentId', '==', agentId)
      .select('odooTeamId', 'displayName')
      .limit(1)
      .get()

    if (usersSnap.empty) {
      // Try by UID (agentId might be the UID itself)
      const userDoc = await adminDb.collection('users').doc(agentId).get()
      if (!userDoc.exists || !userDoc.data()?.odooTeamId) {
        return NextResponse.json({
          clients: [],
          summary: { totalClients: 0, totalOrders: 0, totalAmount: 0, totalPaid: 0, totalResidual: 0 },
          agentName: null,
          odooTeamId: null,
        } satisfies AgentClientsResponse)
      }

      const userData = userDoc.data()!
      return await fetchAndReturnClients(
        userData.odooTeamId as number,
        (userData.displayName as string) ?? null
      )
    }

    const userData = usersSnap.docs[0].data()
    const odooTeamId = userData.odooTeamId as number | undefined

    if (!odooTeamId) {
      return NextResponse.json({
        clients: [],
        summary: { totalClients: 0, totalOrders: 0, totalAmount: 0, totalPaid: 0, totalResidual: 0 },
        agentName: (userData.displayName as string) ?? null,
        odooTeamId: null,
      } satisfies AgentClientsResponse)
    }

    return await fetchAndReturnClients(
      odooTeamId,
      (userData.displayName as string) ?? null
    )
  } catch (error) {
    return handleApiError(error)
  }
}

async function fetchAndReturnClients(
  odooTeamId: number,
  agentName: string | null
): Promise<NextResponse<AgentClientsResponse>> {
  const client = getOdooClient()

  // Step 2: Fetch sale.orders for this agent's team
  const ordersResult = await withCacheFallback<OdooRecord[]>(
    'sale.order',
    `agent-clients-${odooTeamId}`,
    () =>
      client.searchRead(
        'sale.order',
        [
          ['team_id', '=', odooTeamId],
          ['state', 'in', ['sale', 'done']],
        ],
        [...ORDER_FIELDS],
        { limit: 5000, order: 'date_order desc' }
      )
  )

  const orders = ordersResult.data

  if (orders.length === 0) {
    return NextResponse.json({
      clients: [],
      summary: { totalClients: 0, totalOrders: 0, totalAmount: 0, totalPaid: 0, totalResidual: 0 },
      agentName,
      odooTeamId,
    })
  }

  // Collect all invoice IDs and partner IDs
  const allInvoiceIds = new Set<number>()
  const allPartnerIds = new Set<number>()

  for (const order of orders) {
    const invoiceIds = order.invoice_ids as number[]
    if (Array.isArray(invoiceIds)) {
      for (const id of invoiceIds) allInvoiceIds.add(id)
    }
    const partnerId = Array.isArray(order.partner_id)
      ? order.partner_id[0] as number
      : order.partner_id as number
    if (partnerId) allPartnerIds.add(partnerId)
  }

  // Step 3: Fetch invoices for payment state
  const invoiceMap = new Map<number, { paymentState: string; amountTotal: number; amountResidual: number }>()

  if (allInvoiceIds.size > 0) {
    try {
      const invoices = await client.read(
        'account.move',
        [...allInvoiceIds],
        [...INVOICE_FIELDS],
      )
      for (const inv of invoices) {
        invoiceMap.set(inv.id as number, {
          paymentState: (inv.payment_state as string) || 'not_paid',
          amountTotal: (inv.amount_total as number) || 0,
          amountResidual: (inv.amount_residual as number) || 0,
        })
      }
    } catch (err) {
      console.warn('[agents/clients] Could not fetch invoices, continuing without:', err)
    }
  }

  // Step 4: Fetch partner details
  const partnerMap = new Map<number, { name: string; email: string | null; phone: string | null; city: string | null }>()

  if (allPartnerIds.size > 0) {
    const partnerIds = [...allPartnerIds]
    // Odoo read() can handle large arrays, but let's batch for safety
    const BATCH_SIZE = 200
    for (let i = 0; i < partnerIds.length; i += BATCH_SIZE) {
      const batch = partnerIds.slice(i, i + BATCH_SIZE)
      const partners = await client.read(
        'res.partner',
        batch,
        [...PARTNER_FIELDS],
      )
      for (const p of partners) {
        partnerMap.set(p.id as number, {
          name: (p.name as string) || 'Sin nombre',
          email: (p.email as string) || null,
          phone: (p.mobile as string) || (p.phone as string) || null,
          city: (p.city as string) || null,
        })
      }
    }
  }

  // Step 5: Group orders by partner → build client list
  const clientMap = new Map<number, {
    partner: { name: string; email: string | null; phone: string | null; city: string | null }
    orders: AgentClientOrder[]
  }>()

  for (const order of orders) {
    const partnerId = Array.isArray(order.partner_id)
      ? order.partner_id[0] as number
      : order.partner_id as number

    if (!partnerId) continue

    if (!clientMap.has(partnerId)) {
      clientMap.set(partnerId, {
        partner: partnerMap.get(partnerId) ?? { name: 'Desconocido', email: null, phone: null, city: null },
        orders: [],
      })
    }

    // Aggregate invoice info for this order
    const invoiceIds = (order.invoice_ids as number[]) || []
    let paymentState: string | null = null
    let amountPaid = 0
    let amountResidual = 0

    for (const invId of invoiceIds) {
      const inv = invoiceMap.get(invId)
      if (inv) {
        paymentState = inv.paymentState
        amountPaid += inv.amountTotal - inv.amountResidual
        amountResidual += inv.amountResidual
      }
    }

    clientMap.get(partnerId)!.orders.push({
      orderId: order.id as number,
      orderName: order.name as string,
      dateOrder: order.date_order as string,
      amountTotal: order.amount_total as number,
      invoiceStatus: (order.invoice_status as string) || '',
      paymentState: paymentState as AgentClientOrder['paymentState'],
      amountPaid,
      amountResidual,
    })
  }

  // Build final client list
  const clients: AgentClient[] = []
  let summaryTotalAmount = 0
  let summaryTotalPaid = 0
  let summaryTotalResidual = 0

  for (const [partnerId, data] of clientMap) {
    const totalAmount = data.orders.reduce((sum, o) => sum + o.amountTotal, 0)
    const totalPaid = data.orders.reduce((sum, o) => sum + o.amountPaid, 0)
    const totalResidual = data.orders.reduce((sum, o) => sum + o.amountResidual, 0)
    const latestOrder = data.orders[0] // Already sorted by date_order desc

    clients.push({
      partnerId,
      name: data.partner.name,
      email: data.partner.email,
      phone: data.partner.phone,
      city: data.partner.city,
      orderCount: data.orders.length,
      totalAmount,
      lastOrderDate: latestOrder?.dateOrder ?? null,
      latestPaymentState: latestOrder?.paymentState ?? null,
      totalPaid,
      totalResidual,
      orders: data.orders,
    })

    summaryTotalAmount += totalAmount
    summaryTotalPaid += totalPaid
    summaryTotalResidual += totalResidual
  }

  // Sort: most orders first, then by total amount
  clients.sort((a, b) => {
    if (a.orderCount !== b.orderCount) return b.orderCount - a.orderCount
    return b.totalAmount - a.totalAmount
  })

  return NextResponse.json({
    clients,
    summary: {
      totalClients: clients.length,
      totalOrders: orders.length,
      totalAmount: summaryTotalAmount,
      totalPaid: summaryTotalPaid,
      totalResidual: summaryTotalResidual,
    },
    agentName,
    odooTeamId,
  })
}
