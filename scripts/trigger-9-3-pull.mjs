/**
 * trigger-9-3-pull.mjs
 * Story 9.3 — dispara manualmente el endpoint pull Odoo → Firestore
 *
 * Uso:
 *   node scripts/trigger-9-3-pull.mjs                  # delta normal, localhost:3000
 *   node scripts/trigger-9-3-pull.mjs --prod            # delta normal, produccion
 *   node scripts/trigger-9-3-pull.mjs --bootstrap       # procesa TODOS los payments desde epoch
 *   node scripts/trigger-9-3-pull.mjs --prod --bootstrap
 *
 * El secret se lee de process.env.ODOO_PULL_SCHEDULER_SECRET
 * o desde .env.local si la variable no esta exportada.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Parse argv
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const isProd = args.includes('--prod');
const isBootstrap = args.includes('--bootstrap');

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

// ---------------------------------------------------------------------------
// Configuracion
// ---------------------------------------------------------------------------
const PROD_URL = 'https://aroundaplanet--arounda-planet.us-east4.hosted.app';
const LOCAL_URL = 'http://localhost:3000';
const baseUrl = isProd ? PROD_URL : LOCAL_URL;
const endpoint = `${baseUrl}/api/odoo/sync/pull-payments`;

const secret = process.env.ODOO_PULL_SCHEDULER_SECRET;
if (!secret) {
  console.error(
    'Error: ODOO_PULL_SCHEDULER_SECRET no esta definido.\n' +
    'Exporta la variable o asegurate de que .env.local la contiene.'
  );
  process.exit(1);
}

const body = isBootstrap ? { bootstrapFromEpoch: true } : {};

// ---------------------------------------------------------------------------
// Ejecutar el request
// ---------------------------------------------------------------------------
console.log(`Entorno : ${isProd ? 'produccion' : 'local'}`);
console.log(`URL     : ${endpoint}`);
console.log(`Modo    : ${isBootstrap ? 'BOOTSTRAP (todos los payments desde epoch)' : 'delta normal'}`);
console.log('');

let res;
try {
  res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Scheduler-Secret': secret,
    },
    body: JSON.stringify(body),
  });
} catch (err) {
  console.error(`Error de red al conectar a ${endpoint}:`);
  console.error(err.message);
  process.exit(1);
}

const statusCode = res.status;
let responseBody;
const contentType = res.headers.get('content-type') || '';
if (contentType.includes('application/json')) {
  responseBody = await res.json();
} else {
  responseBody = await res.text();
}

console.log(`Status  : ${statusCode}`);
console.log('');
console.log('Response:');
console.log(typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody, null, 2));
console.log('');

if (statusCode === 200) {
  console.log('OK: pull ejecutado correctamente.');
  process.exit(0);
} else {
  console.error(`FALLO: el endpoint respondio con status ${statusCode}.`);
  process.exit(1);
}
