import { getOdooClient } from '@/lib/odoo/client'

// === Types ===

export interface TripSaleOrder {
  orderId: number
  orderName: string
  state: 'draft' | 'sale' | 'cancel' | 'done'
  dateOrder: string
  amountTotal: number
  currencyCode: string
  invoiceStatus: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  customerCity: string | null
  agentName: string | null
  paymentState: 'paid' | 'partial' | 'not_paid' | 'in_payment' | null
  amountPaid: number
  amountResidual: number
}

export interface TripSalesResult {
  orders: TripSaleOrder[]
  summary: {
    totalOrders: number
    totalAmount: number
    totalPaid: number
    totalResidual: number
    byPaymentState: Record<string, number>
  }
}

// === Fetch ===

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
 * Fetch sales orders for a trip product from Odoo.
 * Queries: sale.order.line → sale.order → account.move → res.partner
 * Returns structured data with payment status per order.
 */
export async function fetchTripSales(odooProductId: number): Promise<TripSalesResult> {
  const client = getOdooClient()

  // Step 1: Find sale.order.line records for this product template
  const orderLines = await client.searchRead(
    'sale.order.line',
    [['product_template_id', '=', odooProductId]],
    ['order_id'],
    { limit: 10000 },
  )

  const orderIds = [...new Set(
    orderLines.map(l => {
      const oid = l.order_id
      return Array.isArray(oid) ? oid[0] as number : oid as number
    }).filter(Boolean),
  )]

  if (orderIds.length === 0) {
    return { orders: [], summary: { totalOrders: 0, totalAmount: 0, totalPaid: 0, totalResidual: 0, byPaymentState: {} } }
  }

  // Step 2: Read sale.orders (only confirmed, not draft)
  const orders = await client.searchRead(
    'sale.order',
    [['id', 'in', orderIds], ['state', 'in', ['sale', 'done']]],
    [...ORDER_FIELDS],
    { limit: 10000, order: 'date_order desc' },
  )

  if (orders.length === 0) {
    return { orders: [], summary: { totalOrders: 0, totalAmount: 0, totalPaid: 0, totalResidual: 0, byPaymentState: {} } }
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

  // Step 3: Read invoices for payment state
  const invoiceMap = new Map<number, { paymentState: string; amountTotal: number; amountResidual: number }>()

  if (allInvoiceIds.size > 0) {
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
  }

  // Step 4: Read partners for customer info
  const partnerMap = new Map<number, { name: string; email: string | null; phone: string | null; city: string | null }>()

  if (allPartnerIds.size > 0) {
    const partners = await client.read(
      'res.partner',
      [...allPartnerIds],
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

  // Step 5: Assemble results
  const result: TripSaleOrder[] = []

  for (const order of orders) {
    const partnerId = Array.isArray(order.partner_id)
      ? order.partner_id[0] as number
      : order.partner_id as number
    const partner = partnerMap.get(partnerId)
    const teamName = Array.isArray(order.team_id)
      ? order.team_id[1] as string
      : null
    const currencyCode = Array.isArray(order.currency_id)
      ? order.currency_id[1] as string
      : 'MXN'

    // Aggregate invoice payment info
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

    result.push({
      orderId: order.id as number,
      orderName: order.name as string,
      state: order.state as TripSaleOrder['state'],
      dateOrder: order.date_order as string,
      amountTotal: order.amount_total as number,
      currencyCode,
      invoiceStatus: (order.invoice_status as string) || '',
      customerName: partner?.name ?? 'Desconocido',
      customerEmail: partner?.email ?? null,
      customerPhone: partner?.phone ?? null,
      customerCity: partner?.city ?? null,
      agentName: teamName,
      paymentState: paymentState as TripSaleOrder['paymentState'],
      amountPaid,
      amountResidual,
    })
  }

  // Summary
  const byPaymentState: Record<string, number> = {}
  let totalAmount = 0
  let totalPaid = 0
  let totalResidual = 0

  for (const o of result) {
    totalAmount += o.amountTotal
    totalPaid += o.amountPaid
    totalResidual += o.amountResidual
    const ps = o.paymentState ?? 'unknown'
    byPaymentState[ps] = (byPaymentState[ps] ?? 0) + 1
  }

  return {
    orders: result,
    summary: {
      totalOrders: result.length,
      totalAmount,
      totalPaid,
      totalResidual,
      byPaymentState,
    },
  }
}
