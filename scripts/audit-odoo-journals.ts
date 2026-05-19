// @ts-nocheck
/**
 * Audit account.journal en Odoo prod para obtener IDs de Bank/Cash.
 * Uso: pnpm tsx scripts/audit-odoo-journals.ts
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })

import { getOdooClient } from '../src/lib/odoo/client'

async function main() {
  const client = getOdooClient()
  let authed = false
  for (let i = 0; i < 5 && !authed; i++) {
    try {
      await client.authenticate()
      authed = true
    } catch (e: any) {
      console.log(`[auth retry ${i + 1}] ${e.code || e.message}`)
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  if (!authed) throw new Error('No se pudo autenticar contra Odoo')
  console.log('[auth] OK\n')

  // 1) Todos los journals activos
  console.log('=== account.journal (todos) ===')
  const journals = await client.searchRead(
    'account.journal',
    [],
    ['id', 'name', 'code', 'type', 'currency_id', 'default_account_id', 'active'],
    { limit: 200, order: 'type, name' },
  )
  console.log(`Total: ${journals.length}`)
  console.log(JSON.stringify(journals, null, 2))

  // 2) Filtros tipo
  const banks = journals.filter((j: any) => j.type === 'bank')
  const cashes = journals.filter((j: any) => j.type === 'cash')
  console.log(`\n--- bank journals: ${banks.length} ---`)
  for (const j of banks) console.log(`  id=${j.id}  code=${j.code}  name=${j.name}  active=${j.active}`)
  console.log(`\n--- cash journals: ${cashes.length} ---`)
  for (const j of cashes) console.log(`  id=${j.id}  code=${j.code}  name=${j.name}  active=${j.active}`)

  // 3) Payment 8134 (Felipe Rubio) — el que sincronizó OK en 9.2
  console.log('\n=== account.payment 8134 (Felipe Rubio referencia) ===')
  const p8134 = await client.read('account.payment', [8134], [
    'id', 'name', 'partner_id', 'amount', 'date', 'journal_id', 'state', 'memo',
  ])
  console.log(JSON.stringify(p8134, null, 2))
  const journalRef = p8134[0] && Array.isArray(p8134[0].journal_id) ? p8134[0].journal_id : null
  if (journalRef) {
    console.log(`\n>>> Payment 8134 journal_id = ${journalRef[0]} (${journalRef[1]})`)
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
