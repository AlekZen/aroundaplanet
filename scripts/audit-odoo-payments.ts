// @ts-nocheck — script auxiliar standalone (dotenv no está en deps, se ejecuta vía tsx ad-hoc).
// Excluir del typecheck del bundle. Si se necesita compilar, agregar `dotenv` a devDeps.
/**
 * Auditoría one-shot: pagos reales en Odoo + módulo Documents.
 * Uso: pnpm tsx scripts/audit-odoo-payments.ts
 */
import { config as loadEnv } from 'dotenv'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

import { getOdooClient } from '../src/lib/odoo/client'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

function many2oneId(v: unknown): number | null {
  return Array.isArray(v) && typeof v[0] === 'number' ? v[0] : null
}
function many2oneName(v: unknown): string | null {
  return Array.isArray(v) && typeof v[1] === 'string' ? v[1] : null
}

async function main() {
  const client = getOdooClient()
  await client.authenticate()
  console.log('[auth] OK')

  const SINCE = daysAgo(60)
  console.log(`[since] ${SINCE}`)

  // (a) account.payment últimos 60 días
  console.log('[a] account.payment ...')
  const payments = await client.searchRead(
    'account.payment',
    [['create_date', '>=', SINCE]],
    [
      'id', 'partner_id', 'amount', 'date', 'journal_id',
      'payment_method_line_id', 'ref', 'state',
      'reconciled_invoice_ids', 'create_date', 'write_date',
      'payment_type', 'partner_type', 'currency_id',
    ],
    { limit: 200, order: 'create_date desc' },
  )
  console.log(`  -> ${payments.length} pagos`)

  // (b) documents.document type=folder (carpetas)
  console.log('[b] documents.document (folders) ...')
  const folders = await client.searchRead(
    'documents.document',
    [['type', '=', 'folder']],
    ['id', 'name', 'folder_id', 'create_date'],
    { limit: 500, order: 'id asc' },
  )
  console.log(`  -> ${folders.length} carpetas`)

  // (c) documents.document files últimos 60 días
  console.log('[c] documents.document (files) ...')
  const documents = await client.searchRead(
    'documents.document',
    [
      ['type', '!=', 'folder'],
      ['create_date', '>=', SINCE],
    ],
    [
      'id', 'name', 'folder_id', 'owner_id', 'partner_id',
      'mimetype', 'create_date', 'res_model', 'res_id', 'type',
    ],
    { limit: 200, order: 'create_date desc' },
  )
  console.log(`  -> ${documents.length} documentos`)

  // (d) sale.order últimos 60 días
  console.log('[d] sale.order ...')
  const orders = await client.searchRead(
    'sale.order',
    [['date_order', '>=', SINCE]],
    [
      'id', 'name', 'partner_id', 'team_id', 'amount_total',
      'invoice_status', 'invoice_ids', 'partner_invoice_id', 'date_order',
    ],
    { limit: 100, order: 'date_order desc' },
  )
  console.log(`  -> ${orders.length} órdenes`)

  // Enriquecer: nombres de journals + payment_method_lines únicos
  const journalIds = [...new Set(payments.map(p => many2oneId(p.journal_id)).filter((x): x is number => x !== null))]
  const pmlIds = [...new Set(payments.map(p => many2oneId(p.payment_method_line_id)).filter((x): x is number => x !== null))]

  const journals = journalIds.length
    ? await client.read('account.journal', journalIds, ['id', 'name', 'type', 'code'])
    : []
  const paymentMethodLines = pmlIds.length
    ? await client.read('account.payment.method.line', pmlIds, ['id', 'name', 'code', 'payment_type'])
    : []

  // Análisis: duplicados pago vs documento (match por partner + amount aprox + fecha cercana)
  const docCandidates = documents.filter(d => {
    const mt = String(d.mimetype ?? '')
    return mt.startsWith('image/') || mt === 'application/pdf'
  })

  const duplicates: Array<{ paymentId: number; documentId: number; partnerId: number | null; amount: number; paymentDate: unknown; documentDate: unknown; reason: string }> = []
  for (const p of payments) {
    const pPartner = many2oneId(p.partner_id)
    const pDate = String(p.create_date ?? '').slice(0, 10)
    for (const d of docCandidates) {
      const dPartner = many2oneId(d.partner_id)
      const dDate = String(d.create_date ?? '').slice(0, 10)
      // Heurística: mismo partner + fecha dentro de 3 días
      if (pPartner && dPartner && pPartner === dPartner) {
        const diffDays = Math.abs(
          (new Date(pDate).getTime() - new Date(dDate).getTime()) / (1000 * 60 * 60 * 24),
        )
        if (diffDays <= 3) {
          duplicates.push({
            paymentId: p.id,
            documentId: d.id,
            partnerId: pPartner,
            amount: Number(p.amount ?? 0),
            paymentDate: p.create_date,
            documentDate: d.create_date,
            reason: `same-partner-${diffDays.toFixed(1)}d`,
          })
        }
      }
    }
  }

  // Pagos huérfanos (sin reconciled_invoice_ids)
  const orphanPayments = payments.filter(p => {
    const r = p.reconciled_invoice_ids
    return !Array.isArray(r) || r.length === 0
  })

  // Top 5 carpetas con más documentos
  const folderFileCount = new Map<number, number>()
  for (const d of documents) {
    const fid = many2oneId(d.folder_id)
    if (fid) folderFileCount.set(fid, (folderFileCount.get(fid) ?? 0) + 1)
  }
  const folderById = new Map(folders.map(f => [f.id as number, f]))
  const topFolders = [...folderFileCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([fid, count]) => ({
      folderId: fid,
      name: String(folderById.get(fid)?.name ?? '?'),
      parentId: many2oneId(folderById.get(fid)?.folder_id),
      fileCount: count,
    }))

  // Distribución por journal
  const byJournal = new Map<string, number>()
  for (const p of payments) {
    const jid = many2oneId(p.journal_id)
    const jname = journals.find(j => j.id === jid)?.name ?? `journal-${jid}`
    byJournal.set(String(jname), (byJournal.get(String(jname)) ?? 0) + 1)
  }

  const byPml = new Map<string, number>()
  for (const p of payments) {
    const pid = many2oneId(p.payment_method_line_id)
    const pname = paymentMethodLines.find(x => x.id === pid)?.name ?? `pml-${pid}`
    byPml.set(String(pname), (byPml.get(String(pname)) ?? 0) + 1)
  }

  // Detectar carpetas que parecen ser "por viaje"
  const folderNameSamples = folders.slice(0, 50).map(f => String(f.name ?? ''))

  const out = {
    generatedAt: new Date().toISOString(),
    windowSince: SINCE,
    counts: {
      payments: payments.length,
      folders: folders.length,
      documents: documents.length,
      documentCandidates: docCandidates.length, // imágenes + PDF
      orders: orders.length,
      orphanPayments: orphanPayments.length,
      duplicateCandidates: duplicates.length,
    },
    journalsUsed: Object.fromEntries(byJournal),
    paymentMethodLinesUsed: Object.fromEntries(byPml),
    journals: journals.map(j => ({ id: j.id, name: j.name, type: j.type, code: j.code })),
    paymentMethodLines: paymentMethodLines.map(p => ({ id: p.id, name: p.name, code: p.code, payment_type: p.payment_type })),
    topFolders,
    folderNameSamples,
    duplicates: duplicates.slice(0, 50),
    payments: payments.slice(0, 30).map(p => ({
      id: p.id,
      partner: many2oneName(p.partner_id),
      partnerId: many2oneId(p.partner_id),
      amount: p.amount,
      date: p.date,
      create_date: p.create_date,
      journal: many2oneName(p.journal_id),
      pml: many2oneName(p.payment_method_line_id),
      ref: p.ref,
      state: p.state,
      reconciledCount: Array.isArray(p.reconciled_invoice_ids) ? p.reconciled_invoice_ids.length : 0,
      payment_type: p.payment_type,
    })),
    documents: documents.slice(0, 30).map(d => ({
      id: d.id,
      name: d.name,
      mimetype: d.mimetype,
      folder: many2oneName(d.folder_id),
      folderId: many2oneId(d.folder_id),
      partner: many2oneName(d.partner_id),
      owner: many2oneName(d.owner_id),
      res_model: d.res_model,
      res_id: d.res_id,
      create_date: d.create_date,
    })),
    orders: orders.slice(0, 30).map(o => ({
      id: o.id,
      name: o.name,
      partner: many2oneName(o.partner_id),
      team: many2oneName(o.team_id),
      amount_total: o.amount_total,
      invoice_status: o.invoice_status,
      invoiceCount: Array.isArray(o.invoice_ids) ? o.invoice_ids.length : 0,
      date_order: o.date_order,
    })),
  }

  const outDir = resolve(process.cwd(), 'scripts/audit-output')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, 'odoo-real-data.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
  console.log(`\n[ok] guardado en ${outPath}`)
  console.log(JSON.stringify(out.counts, null, 2))
}

main().catch(err => {
  console.error('[fail]', err?.message ?? err)
  process.exit(1)
})
