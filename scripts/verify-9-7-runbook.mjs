// Verifica si los custom fields del runbook 9.7 ya existen en Odoo prod.
// READ-ONLY. Sin escrituras.

import xmlrpc from 'xmlrpc';
import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const url = process.env.ODOO_URL;
const db = process.env.ODOO_DB;
const user = process.env.ODOO_USERNAME || process.env.ODOO_USER;
const apiKey = process.env.ODOO_API_KEY || process.env.ODOO_PASSWORD;

if (!url || !db || !user || !apiKey) {
  console.error('Falta env: ODOO_URL/DB/USER/API_KEY en .env.local');
  process.exit(1);
}

const common = xmlrpc.createSecureClient({ url: `${url}/xmlrpc/2/common` });
const models = xmlrpc.createSecureClient({ url: `${url}/xmlrpc/2/object` });

const call = (client, method, args) =>
  new Promise((res, rej) => client.methodCall(method, args, (e, v) => (e ? rej(e) : res(v))));

const uid = await call(common, 'authenticate', [db, user, apiKey, {}]);
if (!uid) { console.error('Auth falló'); process.exit(1); }

const expectedFields = [
  'x_firebase_payment_id',
  'x_firebase_agent_uid',
  'x_ocr_confidence',
  'x_canonical_payment_id',
];

const found = await call(models, 'execute_kw', [
  db, uid, apiKey,
  'ir.model.fields', 'search_read',
  [[['model', '=', 'account.payment'], ['name', 'in', expectedFields]]],
  { fields: ['name', 'ttype', 'field_description'], limit: 50 },
]);

const foundNames = new Set(found.map(f => f.name));

console.log('=== Custom fields runbook 9.7 en account.payment ===');
for (const f of expectedFields) {
  const exists = foundNames.has(f);
  console.log(`${exists ? '✅' : '❌'} ${f}`);
}

// Tags
const tags = await call(models, 'execute_kw', [
  db, uid, apiKey,
  'account.account.tag', 'search_read',
  [[['name', 'in', ['dup-canonico', 'dup-secundario']]]],
  { fields: ['name'], limit: 10 },
]).catch(() => null);

console.log('\n=== Tags dup-canonico / dup-secundario ===');
if (tags === null) {
  // probar otro modelo: account.payment usa account.account.tag o crm.tag? Probemos res.partner.category o mail.activity.type? Realmente para payments el tag suele ser account.account.tag o un campo Many2many propio.
  console.log('⚠️ Modelo account.account.tag no encontrado o sin acceso — checar manual con Paloma');
} else if (tags.length === 0) {
  console.log('❌ Tags NO existen');
} else {
  for (const t of tags) console.log(`✅ ${t.name}`);
}

// Verificar modelo de tag genérico que aplique a payments
const paymentTagField = await call(models, 'execute_kw', [
  db, uid, apiKey,
  'ir.model.fields', 'search_read',
  [[['model', '=', 'account.payment'], ['name', 'like', 'tag']]],
  { fields: ['name', 'ttype', 'relation'], limit: 20 },
]);

console.log('\n=== Campos tipo tag en account.payment (cualquier nombre) ===');
for (const f of paymentTagField) {
  console.log(`  ${f.name} (${f.ttype}) → ${f.relation || '-'}`);
}

console.log('\nDONE.');
