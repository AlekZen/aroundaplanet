// @ts-nocheck
/**
 * Audit cluster c_5403_5405 — account.payment 5403 y 5405 (ALEJANDRA MENDOZA NUÑO)
 * Uso: pnpm tsx scripts/audit-payments-5403-5405.ts
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })

import { getOdooClient } from '../src/lib/odoo/client'

async function main() {
  const client = getOdooClient()
  // retry auth manually with backoff
  let authed = false
  for (let i = 0; i < 5 && !authed; i++) {
    try {
      await client.authenticate()
      authed = true
    } catch (e: any) {
      console.log(`[auth retry ${i+1}] ${e.code || e.message}`)
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  if (!authed) throw new Error('No se pudo autenticar contra Odoo')
  console.log('[auth] OK\n')

  const PAYMENT_IDS = [5403, 5405]

  // 1) account.payment campos clave
  const payments = await client.read('account.payment', PAYMENT_IDS, [
    'id', 'name', 'partner_id', 'amount', 'date', 'journal_id',
    'payment_method_line_id', 'memo', 'state', 'move_id',
    'write_date', 'create_date', 'create_uid', 'write_uid',
    'payment_type', 'partner_type', 'reconciled_invoice_ids',
    'x_dup_status', 'x_canonical_payment_id', 'x_firebase_payment_id',
    'x_firebase_agent_uid',
  ])

  console.log('=== account.payment ===')
  for (const p of payments) {
    console.log(JSON.stringify(p, null, 2))
    console.log('---')
  }

  // 2) ir.model.data (xmlid) provenance
  const moveIds = payments.map(p => Array.isArray(p.move_id) ? p.move_id[0] : null).filter(Boolean)
  console.log('\n=== ir.model.data (provenance account.payment) ===')
  const xmlidsPay = await client.searchRead(
    'ir.model.data',
    [['model', '=', 'account.payment'], ['res_id', 'in', PAYMENT_IDS]],
    ['id', 'module', 'name', 'res_id', 'model', 'create_date'],
    { limit: 50 },
  )
  console.log(JSON.stringify(xmlidsPay, null, 2))

  console.log('\n=== ir.model.data (provenance account.move) ===')
  const xmlidsMove = await client.searchRead(
    'ir.model.data',
    [['model', '=', 'account.move'], ['res_id', 'in', moveIds]],
    ['id', 'module', 'name', 'res_id', 'create_date'],
    { limit: 50 },
  )
  console.log(JSON.stringify(xmlidsMove, null, 2))

  // 3) account.move padres de los payments (estos son los moves del propio payment, no la invoice)
  console.log('\n=== account.move (payment moves) ===')
  if (moveIds.length) {
    const moves = await client.read('account.move', moveIds, [
      'id', 'name', 'ref', 'date', 'state', 'amount_total', 'partner_id', 'line_ids', 'create_date',
    ])
    console.log(JSON.stringify(moves, null, 2))
  }

  // 4) Buscar la invoice INV/2025/00533 y sus move lines + payments enlazados
  console.log('\n=== invoice INV/2025/00533 ===')
  const invoices = await client.searchRead(
    'account.move',
    [['name', '=', 'INV/2025/00533']],
    ['id', 'name', 'partner_id', 'amount_total', 'amount_residual', 'state', 'invoice_date', 'payment_state', 'line_ids', 'invoice_line_ids'],
    { limit: 5 },
  )
  console.log(JSON.stringify(invoices, null, 2))

  // 5) Para cada partner_id (cliente Alejandra) buscar TODOS sus payments para ver historial
  const partnerId = payments[0] && Array.isArray(payments[0].partner_id) ? payments[0].partner_id[0] : null
  if (partnerId) {
    console.log(`\n=== TODOS los payments del partner ${partnerId} (Alejandra) ===`)
    const allPayments = await client.searchRead(
      'account.payment',
      [['partner_id', '=', partnerId]],
      ['id', 'name', 'amount', 'date', 'memo', 'state', 'create_date', 'create_uid', 'journal_id'],
      { limit: 100, order: 'date asc' },
    )
    console.log(`Total: ${allPayments.length}`)
    console.log(JSON.stringify(allPayments, null, 2))
  }

  // 6) Reconciliation: ¿qué partial_reconcile une payments a la invoice?
  if (invoices.length) {
    const invId = invoices[0].id
    console.log(`\n=== account.move.line de invoice ${invId} (receivables + sus matching) ===`)
    const invLines = await client.searchRead(
      'account.move.line',
      [['move_id', '=', invId], ['account_id.account_type', '=', 'asset_receivable']],
      ['id', 'name', 'debit', 'credit', 'amount_residual', 'matched_credit_ids', 'matched_debit_ids', 'reconciled'],
      { limit: 20 },
    )
    console.log(JSON.stringify(invLines, null, 2))
  }

  // 7) Lookup users that created
  const userIds = [...new Set(payments.map(p => Array.isArray(p.create_uid) ? p.create_uid[0] : null).filter(Boolean))]
  if (userIds.length) {
    console.log('\n=== res.users (creadores) ===')
    const users = await client.read('res.users', userIds, ['id', 'name', 'login'])
    console.log(JSON.stringify(users, null, 2))
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
