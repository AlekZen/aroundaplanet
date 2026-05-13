/**
 * Auditoría one-shot: pagos reales en Odoo + módulo Documents.
 * Uso: node scripts/audit-odoo-payments.mjs
 */
import xmlrpc from 'xmlrpc'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Cargar .env.local manualmente
try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const ODOO_URL = process.env.ODOO_URL
const ODOO_DB = process.env.ODOO_DB
const ODOO_USERNAME = process.env.ODOO_USERNAME
const ODOO_API_KEY = process.env.ODOO_API_KEY

if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_API_KEY) {
  console.error('[fail] faltan variables: ODOO_URL/ODOO_DB/ODOO_USERNAME/ODOO_API_KEY')
  process.exit(1)
}

const host = new URL(ODOO_URL).hostname
function createClient(p) {
  return xmlrpc.createSecureClient({ host, port: 443, path: p })
}
function call(client, method, params, timeoutMs = 60000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`Timeout ${timeoutMs}ms en ${method}`)), timeoutMs)
    client.methodCall(method, params, (err, val) => {
      clearTimeout(t)
      if (err) rej(err)
      else res(val)
    })
  })
}

const common = createClient('/xmlrpc/2/common')
const object = createClient('/xmlrpc/2/object')

async function auth() {
  const uid = await call(common, 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
  if (!uid) throw new Error('auth falló')
  return uid
}

async function execKw(uid, model, method, args, kwargs = {}, timeoutMs = 60000) {
  return call(object, 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs], timeoutMs)
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}
const m2oId = v => Array.isArray(v) && typeof v[0] === 'number' ? v[0] : null
const m2oName = v => Array.isArray(v) && typeof v[1] === 'string' ? v[1] : null

async function main() {
  const uid = await auth()
  console.log(`[auth] OK uid=${uid}`)

  const SINCE = daysAgo(60)
  console.log(`[since] ${SINCE}`)

  console.log('[a] account.payment ...')
  const payments = await execKw(uid, 'account.payment', 'search_read',
    [[['create_date', '>=', SINCE]]],
    { fields: ['id','partner_id','amount','date','journal_id','payment_method_line_id','memo','state','reconciled_invoice_ids','create_date','write_date','payment_type','partner_type','currency_id'], limit: 200, order: 'create_date desc' },
  )
  console.log(`  -> ${payments.length} pagos`)
  await sleep(1100)

  console.log('[b] documents.document folders ...')
  const folders = await execKw(uid, 'documents.document', 'search_read',
    [[['type', '=', 'folder']]],
    { fields: ['id','name','folder_id','create_date'], limit: 500, order: 'id asc' },
  )
  console.log(`  -> ${folders.length} carpetas`)
  await sleep(1100)

  console.log('[c] documents.document files ...')
  const documents = await execKw(uid, 'documents.document', 'search_read',
    [[['type', '!=', 'folder'], ['create_date', '>=', SINCE]]],
    { fields: ['id','name','folder_id','owner_id','partner_id','mimetype','create_date','res_model','res_id','type'], limit: 200, order: 'create_date desc' },
  )
  console.log(`  -> ${documents.length} documentos`)
  await sleep(1100)

  console.log('[d] sale.order ...')
  const orders = await execKw(uid, 'sale.order', 'search_read',
    [[['date_order', '>=', SINCE]]],
    { fields: ['id','name','partner_id','team_id','amount_total','invoice_status','invoice_ids','partner_invoice_id','date_order'], limit: 100, order: 'date_order desc' },
  )
  console.log(`  -> ${orders.length} órdenes`)
  await sleep(1100)

  const journalIds = [...new Set(payments.map(p => m2oId(p.journal_id)).filter(x => x !== null))]
  const pmlIds = [...new Set(payments.map(p => m2oId(p.payment_method_line_id)).filter(x => x !== null))]

  console.log(`[enrich] journals=${journalIds.length} pml=${pmlIds.length}`)
  const journals = journalIds.length ? await execKw(uid, 'account.journal', 'read', [journalIds], { fields: ['id','name','type','code'] }) : []
  await sleep(1100)
  const pml = pmlIds.length ? await execKw(uid, 'account.payment.method.line', 'read', [pmlIds], { fields: ['id','name','code','payment_type'] }) : []

  // Análisis
  const docCandidates = documents.filter(d => {
    const mt = String(d.mimetype ?? '')
    return mt.startsWith('image/') || mt === 'application/pdf'
  })

  const duplicates = []
  for (const p of payments) {
    const pPartner = m2oId(p.partner_id)
    const pDate = String(p.create_date ?? '').slice(0, 10)
    if (!pPartner || !pDate) continue
    for (const d of docCandidates) {
      const dPartner = m2oId(d.partner_id)
      const dDate = String(d.create_date ?? '').slice(0, 10)
      if (dPartner && pPartner === dPartner) {
        const diff = Math.abs((new Date(pDate).getTime() - new Date(dDate).getTime()) / 86400000)
        if (diff <= 3) {
          duplicates.push({
            paymentId: p.id, documentId: d.id, partnerId: pPartner,
            paymentAmount: p.amount, paymentDate: p.create_date,
            documentName: d.name, documentMime: d.mimetype, documentDate: d.create_date,
            diffDays: Number(diff.toFixed(1)),
          })
        }
      }
    }
  }

  const orphanPayments = payments.filter(p => !Array.isArray(p.reconciled_invoice_ids) || p.reconciled_invoice_ids.length === 0)

  const folderById = new Map(folders.map(f => [f.id, f]))
  const folderFileCount = new Map()
  for (const d of documents) {
    const fid = m2oId(d.folder_id)
    if (fid) folderFileCount.set(fid, (folderFileCount.get(fid) ?? 0) + 1)
  }
  const topFolders = [...folderFileCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([fid, count]) => ({
      folderId: fid,
      name: String(folderById.get(fid)?.name ?? '?'),
      parentName: m2oName(folderById.get(fid)?.folder_id),
      fileCount: count,
    }))

  const byJournal = {}
  for (const p of payments) {
    const jid = m2oId(p.journal_id)
    const j = journals.find(x => x.id === jid)
    const key = j ? `${j.name} (${j.type}/${j.code})` : `journal-${jid}`
    byJournal[key] = (byJournal[key] ?? 0) + 1
  }
  const byPml = {}
  for (const p of payments) {
    const pid = m2oId(p.payment_method_line_id)
    const x = pml.find(v => v.id === pid)
    const key = x ? `${x.name} (${x.code})` : `pml-${pid}`
    byPml[key] = (byPml[key] ?? 0) + 1
  }

  const out = {
    generatedAt: new Date().toISOString(),
    windowSince: SINCE,
    counts: {
      payments: payments.length,
      folders: folders.length,
      documents: documents.length,
      documentCandidates: docCandidates.length,
      orders: orders.length,
      orphanPayments: orphanPayments.length,
      duplicateCandidates: duplicates.length,
    },
    journalsUsed: byJournal,
    paymentMethodLinesUsed: byPml,
    journals: journals.map(j => ({ id: j.id, name: j.name, type: j.type, code: j.code })),
    paymentMethodLines: pml.map(p => ({ id: p.id, name: p.name, code: p.code, payment_type: p.payment_type })),
    topFolders,
    folderNameSamples: folders.slice(0, 80).map(f => ({ id: f.id, name: f.name, parent: m2oName(f.folder_id) })),
    duplicates: duplicates.slice(0, 80),
    paymentsAll: payments.map(p => ({
      id: p.id, partner: m2oName(p.partner_id), partnerId: m2oId(p.partner_id),
      amount: p.amount, date: p.date, create_date: p.create_date, write_date: p.write_date,
      journal: m2oName(p.journal_id), journalId: m2oId(p.journal_id),
      pml: m2oName(p.payment_method_line_id), pmlId: m2oId(p.payment_method_line_id),
      memo: p.memo, state: p.state,
      reconciledInvoiceIds: Array.isArray(p.reconciled_invoice_ids) ? p.reconciled_invoice_ids : [],
      reconciledCount: Array.isArray(p.reconciled_invoice_ids) ? p.reconciled_invoice_ids.length : 0,
      payment_type: p.payment_type, partner_type: p.partner_type,
      currency: m2oName(p.currency_id),
    })),
    documentsAll: documents.map(d => ({
      id: d.id, name: d.name, mimetype: d.mimetype,
      folder: m2oName(d.folder_id), folderId: m2oId(d.folder_id),
      partner: m2oName(d.partner_id), partnerId: m2oId(d.partner_id),
      owner: m2oName(d.owner_id),
      res_model: d.res_model, res_id: d.res_id, create_date: d.create_date,
    })),
    foldersAll: folders.map(f => ({
      id: f.id, name: f.name,
      parentId: m2oId(f.folder_id), parentName: m2oName(f.folder_id),
      create_date: f.create_date,
    })),
    ordersSample: orders.slice(0, 30).map(o => ({
      id: o.id, name: o.name, partner: m2oName(o.partner_id),
      team: m2oName(o.team_id), amount_total: o.amount_total,
      invoice_status: o.invoice_status,
      invoiceCount: Array.isArray(o.invoice_ids) ? o.invoice_ids.length : 0,
      date_order: o.date_order,
    })),
  }

  const outDir = resolve(process.cwd(), 'scripts/audit-output')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, 'odoo-real-data.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
  console.log(`\n[ok] ${outPath}`)
  console.log(JSON.stringify(out.counts, null, 2))
}

main().catch(e => {
  console.error('[fail]', e?.message ?? e)
  process.exit(1)
})
