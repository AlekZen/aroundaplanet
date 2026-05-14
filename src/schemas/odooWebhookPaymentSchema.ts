import { z } from 'zod'

/**
 * Payload del webhook outgoing de Odoo Automation Rule `account.payment` (Story 9.3, AC6).
 * Odoo envía un objeto plano con los campos del payment al hacer "On Save".
 *
 * Para `journal_id` y `partner_id`, Odoo siempre serializa como tupla `[id, name]`
 * (formato many2one). Aceptamos también el id desnudo por robustez si Paloma
 * configura `read_group` o similar.
 */

const many2one = z.union([
  z.tuple([z.number().int().positive(), z.string()]),
  z.number().int().positive(),
])

export type OdooMany2One = z.infer<typeof many2one>

/** Helper: extrae [id, name] o id desnudo a {id, name?}. */
export function unpackMany2One(v: OdooMany2One | null | undefined): {
  id: number | null
  name: string | null
} {
  if (v == null) return { id: null, name: null }
  if (Array.isArray(v)) return { id: v[0], name: v[1] }
  return { id: v, name: null }
}

export const odooWebhookPaymentSchema = z.object({
  id: z.number().int().positive(),
  state: z.string().min(1).max(32),
  journal_id: many2one.nullable().optional(),
  partner_id: many2one.nullable().optional(),
  amount: z.number(),
  date: z.string().min(1).max(32),
  memo: z.string().max(2000).nullable().optional(),
  write_date: z.string().min(1).max(32),
  reconciled_invoice_ids: z.array(z.number().int().positive()).optional(),
  x_firebase_payment_id: z.string().max(128).nullable().optional(),
  x_firebase_agent_uid: z.string().max(128).nullable().optional(),
})

export type OdooWebhookPayment = z.infer<typeof odooWebhookPaymentSchema>
