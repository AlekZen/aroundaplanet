/**
 * verify-9-3-smoke.mjs
 * Story 9.3 — verificacion smoke del estado Odoo mirror en Firestore
 *
 * Uso:
 *   node scripts/verify-9-3-smoke.mjs <firestoreId>
 *   node scripts/verify-9-3-smoke.mjs <firestoreId> --snapshot snapshots/9-3-baseline.json
 *
 * Flags:
 *   --snapshot <path>  Compara contra snapshot JSON guardado. Si el path no existe,
 *                      crea el snapshot con el estado actual. Si existe y detecta cambio
 *                      en campos Firestore-owned, imprime diff y sale con exit code 1.
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Parse argv
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const firestoreId = args[0];
if (!firestoreId || firestoreId.startsWith('--')) {
  console.error('Uso: node scripts/verify-9-3-smoke.mjs <firestoreId> [--snapshot <path>]');
  process.exit(1);
}

let snapshotPath = null;
const snapshotIdx = args.indexOf('--snapshot');
if (snapshotIdx !== -1) {
  snapshotPath = args[snapshotIdx + 1];
  if (!snapshotPath) {
    console.error('Error: --snapshot requiere un path como argumento.');
    process.exit(1);
  }
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

// ---------------------------------------------------------------------------
// Init Firebase Admin SDK
// ---------------------------------------------------------------------------
const keyPath = resolve(process.cwd(), '.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json');
const key = JSON.parse(readFileSync(keyPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Leer documento de Firestore
// ---------------------------------------------------------------------------
const docRef = db.collection('payments').doc(firestoreId);
const snap = await docRef.get();

if (!snap.exists) {
  console.error(`Error: no se encontro el documento payments/${firestoreId} en Firestore.`);
  process.exit(1);
}

const data = snap.data();

// ---------------------------------------------------------------------------
// Campos Odoo-mirror que esta story actualiza
// ---------------------------------------------------------------------------
const odooFields = {
  odooPaymentId:           data.odooPaymentId          ?? null,
  odooState:               data.odooState              ?? null,
  odooJournalId:           data.odooJournalId          ?? null,
  odooJournalName:         data.odooJournalName        ?? null,
  odooReconciled:          data.odooReconciled         ?? null,
  odooReconciledInvoiceIds: data.odooReconciledInvoiceIds ?? null,
  odooCanceledAt:          data.odooCanceledAt         ?? null,
  odooSyncedAt:            data.odooSyncedAt           ?? null,
  odooLastError:           data.odooLastError          ?? null,
};

// ---------------------------------------------------------------------------
// Campos LWW / memo del payment
// ---------------------------------------------------------------------------
const lwwFields = {
  memo:        data.lww?.memo        ?? data.bankReference ?? null,
  amount:      data.lww?.amount      ?? data.amount        ?? null,
  paymentDate: data.lww?.paymentDate ?? data.paymentDate   ?? null,
};

// ---------------------------------------------------------------------------
// Campos Firestore-owned (NO deben cambiar cuando el pull actualiza)
// ---------------------------------------------------------------------------
const firestoreOwnedFields = {
  status:     data.status     ?? null,
  agentId:    data.agentId    ?? null,
  clientName: data.clientName ?? null,
  receiptUrl: data.receiptUrl ?? null,
  ocrData:    data.ocrData    ?? null,
  verifiedBy: data.verifiedBy ?? null,
  verifiedAt: data.verifiedAt ?? null,
};

// ---------------------------------------------------------------------------
// Imprimir resultado pretty
// ---------------------------------------------------------------------------
console.log('');
console.log('=== verify-9-3-smoke.mjs ===');
console.log(`  Document : payments/${firestoreId}`);
console.log('');
console.log('--- Campos Odoo mirror ---');
for (const [k, v] of Object.entries(odooFields)) {
  const display = v === null ? '(null)' : (v instanceof admin.firestore.Timestamp ? v.toDate().toISOString() : String(v));
  console.log(`  ${k.padEnd(28)} ${display}`);
}
console.log('');
console.log('--- LWW / memo del payment ---');
for (const [k, v] of Object.entries(lwwFields)) {
  const display = v === null ? '(null)' : (v instanceof admin.firestore.Timestamp ? v.toDate().toISOString() : String(v));
  console.log(`  lww.${k.padEnd(24)} ${display}`);
}
console.log('');
console.log('--- Campos Firestore-owned ---');
for (const [k, v] of Object.entries(firestoreOwnedFields)) {
  const display = v === null ? '(null)' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  console.log(`  ${k.padEnd(28)} ${display}`);
}
console.log('');

// ---------------------------------------------------------------------------
// Logica de snapshot
// ---------------------------------------------------------------------------
if (snapshotPath) {
  const absSnapshot = resolve(process.cwd(), snapshotPath);

  if (!existsSync(absSnapshot)) {
    // Crear snapshot con estado actual
    const snapshotData = {
      firestoreId,
      capturedAt: new Date().toISOString(),
      firestoreOwnedFields,
    };
    writeFileSync(absSnapshot, JSON.stringify(snapshotData, null, 2), 'utf8');
    console.log(`Snapshot creado en: ${absSnapshot}`);
    console.log('Ejecuta de nuevo con el mismo --snapshot para comparar.');
  } else {
    // Comparar contra snapshot existente
    const saved = JSON.parse(readFileSync(absSnapshot, 'utf8'));
    const savedOwned = saved.firestoreOwnedFields;
    let hasForbiddenChange = false;

    console.log(`Comparando contra snapshot: ${absSnapshot} (capturado ${saved.capturedAt})`);
    console.log('');
    console.log('--- Diff campos Firestore-owned ---');

    for (const [k, vNow] of Object.entries(firestoreOwnedFields)) {
      const vPrev = savedOwned[k] ?? null;
      const nowStr = vNow === null ? '(null)' : String(vNow);
      const prevStr = vPrev === null ? '(null)' : String(vPrev);
      if (nowStr !== prevStr) {
        console.error(`  CAMBIO PROHIBIDO en "${k}": "${prevStr}" → "${nowStr}"`);
        hasForbiddenChange = true;
      } else {
        console.log(`  OK  ${k.padEnd(26)} ${nowStr}`);
      }
    }

    console.log('');
    if (hasForbiddenChange) {
      console.error('FALLO: se detectaron cambios en campos Firestore-owned. El pull Odoo NO debe tocar estos campos.');
      process.exit(1);
    } else {
      console.log('OK: ningun campo Firestore-owned fue modificado. El pull respeta los campos propietarios.');
    }
  }
}

process.exit(0);
