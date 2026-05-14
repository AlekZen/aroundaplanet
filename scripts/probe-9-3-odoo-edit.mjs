/**
 * probe-9-3-odoo-edit.mjs
 * Story 9.3 — escribe un campo en account.payment via XML-RPC y muestra
 *             el write_date antes y despues para confirmar que Odoo actualiza
 *             el timestamp (lo que dispara el delta del pull).
 *
 * Uso:
 *   node scripts/probe-9-3-odoo-edit.mjs <paymentId> '<json_de_cambios>'
 *
 * Ejemplos:
 *   node scripts/probe-9-3-odoo-edit.mjs 8134 '{"ref": "TEST probe-9-3"}'
 *   node scripts/probe-9-3-odoo-edit.mjs 8134 '{"journal_id": 14}'
 *
 * Usa env vars: ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY
 * Si no estan exportadas, las lee de .env.local automaticamente.
 */

import xmlrpc from 'xmlrpc';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Parse argv
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const paymentIdRaw = args[0];
const changesRaw = args[1];

if (!paymentIdRaw || !changesRaw) {
  console.error(
    'Uso: node scripts/probe-9-3-odoo-edit.mjs <paymentId> \'<json_de_cambios>\'\n' +
    'Ejemplo: node scripts/probe-9-3-odoo-edit.mjs 8134 \'{"ref": "TEST probe-9-3"}\''
  );
  process.exit(1);
}

const paymentId = parseInt(paymentIdRaw, 10);
if (isNaN(paymentId) || paymentId <= 0) {
  console.error(`Error: paymentId debe ser un entero positivo, recibido: "${paymentIdRaw}"`);
  process.exit(1);
}

let changes;
try {
  changes = JSON.parse(changesRaw);
} catch {
  console.error(`Error: el segundo argumento no es JSON valido: ${changesRaw}`);
  process.exit(1);
}

if (typeof changes !== 'object' || Array.isArray(changes) || changes === null) {
  console.error('Error: los cambios deben ser un objeto JSON plano, ej: \'{"ref": "valor"}\'');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Cargar .env.local si las vars no estan en el entorno
// ---------------------------------------------------------------------------
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const ODOO_URL      = process.env.ODOO_URL;
const ODOO_DB       = process.env.ODOO_DB;
const ODOO_USERNAME = process.env.ODOO_USERNAME;
const ODOO_API_KEY  = process.env.ODOO_API_KEY;

const missing = ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_API_KEY'].filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`Error: faltan las siguientes variables de entorno: ${missing.join(', ')}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers XML-RPC — mismo patron que src/lib/odoo/client.ts
// ---------------------------------------------------------------------------
const urlObj = new URL(ODOO_URL);
const clientOpts = {
  host: urlObj.hostname,
  port: Number(urlObj.port) || 443,
};

const common = xmlrpc.createSecureClient({ ...clientOpts, path: '/xmlrpc/2/common' });
const models = xmlrpc.createSecureClient({ ...clientOpts, path: '/xmlrpc/2/object' });

const call = (client, method, params) =>
  new Promise((resolve, reject) =>
    client.methodCall(method, params, (err, val) => (err ? reject(err) : resolve(val)))
  );

// ---------------------------------------------------------------------------
// Autenticar
// ---------------------------------------------------------------------------
console.log(`Autenticando en ${ODOO_URL} (db=${ODOO_DB}, user=${ODOO_USERNAME})...`);
const uid = await call(common, 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}]);

if (uid === false || typeof uid !== 'number') {
  console.error('Error: autenticacion fallida. Verifica ODOO_USERNAME y ODOO_API_KEY.');
  process.exit(1);
}
console.log(`Autenticado, uid=${uid}`);
console.log('');

// ---------------------------------------------------------------------------
// Leer write_date ANTES del cambio
// ---------------------------------------------------------------------------
const readFields = ['id', 'name', 'state', 'amount', 'date', 'write_date', ...Object.keys(changes)];

const beforeList = await call(models, 'execute_kw', [
  ODOO_DB, uid, ODOO_API_KEY,
  'account.payment', 'read',
  [[paymentId]],
  { fields: readFields },
]);

if (!beforeList || beforeList.length === 0) {
  console.error(`Error: no se encontro account.payment con id=${paymentId}`);
  process.exit(1);
}

const before = beforeList[0];
console.log('--- Estado ANTES del cambio ---');
for (const [k, v] of Object.entries(before)) {
  console.log(`  ${k.padEnd(20)} ${JSON.stringify(v)}`);
}
console.log('');

// ---------------------------------------------------------------------------
// Aplicar el write
// ---------------------------------------------------------------------------
console.log(`Aplicando write en account.payment id=${paymentId}:`);
console.log(JSON.stringify(changes, null, 2));
console.log('');

const writeResult = await call(models, 'execute_kw', [
  ODOO_DB, uid, ODOO_API_KEY,
  'account.payment', 'write',
  [[paymentId], changes],
  {},
]);

if (writeResult !== true) {
  console.error(`Error inesperado: Odoo retorno ${JSON.stringify(writeResult)} en lugar de true.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Leer write_date DESPUES del cambio
// ---------------------------------------------------------------------------
const afterList = await call(models, 'execute_kw', [
  ODOO_DB, uid, ODOO_API_KEY,
  'account.payment', 'read',
  [[paymentId]],
  { fields: readFields },
]);

const after = afterList[0];
console.log('--- Estado DESPUES del cambio ---');
for (const [k, v] of Object.entries(after)) {
  console.log(`  ${k.padEnd(20)} ${JSON.stringify(v)}`);
}
console.log('');

// ---------------------------------------------------------------------------
// Comparar write_date
// ---------------------------------------------------------------------------
const wdBefore = before.write_date;
const wdAfter  = after.write_date;

if (wdBefore !== wdAfter) {
  console.log(`write_date actualizado: "${wdBefore}" → "${wdAfter}"`);
  console.log('OK: Odoo actualiza write_date al hacer el write. El delta del pull lo capturara.');
} else {
  console.warn(`ADVERTENCIA: write_date no cambio (sigue "${wdAfter}").`);
  console.warn('Odoo puede no actualizar write_date si el valor es identico al anterior.');
  console.warn('Prueba con un valor diferente al actual.');
}

process.exit(0);
