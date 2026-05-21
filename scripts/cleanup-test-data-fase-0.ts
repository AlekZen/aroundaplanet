/**
 * cleanup-test-data-fase-0.ts
 *
 * Script idempotente para archivar datos de prueba identificados en sesión 46 (cierre Fase 0).
 *
 * RESTRICCIONES FIRMES:
 * - NUNCA borra documentos. Solo archiva con `archived: true` + `archivedAt` + `archivedReason`
 *   y opcionalmente renombra `nombreCliente`/`customerName` prefijando `_CLEANED_<timestamp>_`.
 * - Read-only por default. Requiere flag `--apply` para escribir.
 * - Idempotente: si ya está archivado, no toca el documento.
 * - Reporta conteos antes/después.
 *
 * USO:
 *   pnpm tsx scripts/cleanup-test-data-fase-0.ts            # dry-run (preview)
 *   pnpm tsx scripts/cleanup-test-data-fase-0.ts --apply    # ejecuta archivado
 *
 * PREREQUISITO: Paloma/Noel deben confirmar la lista antes de correr con --apply.
 *
 * Candidatos identificados sesión 46 (apartado 7.5.3 del objetivo cierre Fase 0).
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'node:fs';
import * as path from 'node:path';

type Candidate = {
  collection: 'quotations' | 'contracts';
  docId: string;
  reason: string;
  action: 'archive' | 'confirm-first';
};

const CANDIDATES: Candidate[] = [
  {
    collection: 'quotations',
    docId: 'wGITlbNiKtqaKQVSPF7T',
    reason: 'nombreCliente="Smoke Test E2E" — smoke automatizado Story 10.1 sesión 43',
    action: 'archive',
  },
  {
    collection: 'contracts',
    docId: 'Go7PsBBTNuyBT6LqD7W3',
    reason: 'duplicado v1 de odoo-sale-13367 (ADRIANA), superseded por v2 Bw3vj7l42Q1ZHyggJq74',
    action: 'archive',
  },
  {
    collection: 'contracts',
    docId: 'Bw3vj7l42Q1ZHyggJq74',
    reason: 'v2 ADRIANA odoo-sale-13367, shared con cliente, smoke E2E — CONFIRMAR antes de archivar',
    action: 'confirm-first',
  },
  {
    collection: 'contracts',
    docId: 'Fb3kHWuSkuu9qy5fvai6',
    reason: 'orderId test-alek-e2e-10-1, nombreCliente="Cliente Prueba Alek E2E"',
    action: 'archive',
  },
  {
    collection: 'contracts',
    docId: 'eYz2CRx9C0MFEHggGEEZ',
    reason: 'nombreCliente="Test Browser" (PERÚ DICIEMBRE 2025)',
    action: 'archive',
  },
];

function loadServiceAccount() {
  const keyPath = path.resolve(
    process.cwd(),
    '.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json',
  );
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Service account no encontrado en ${keyPath}`);
  }
  return JSON.parse(fs.readFileSync(keyPath, 'utf8'));
}

function initAdmin() {
  if (getApps().length === 0) {
    initializeApp({ credential: cert(loadServiceAccount()) });
  }
  return getFirestore();
}

async function main() {
  const apply = process.argv.includes('--apply');
  const mode = apply ? 'APPLY (escribirá Firestore)' : 'DRY-RUN (read-only)';

  console.log(`\n=== Cleanup Test Data Fase 0 — modo: ${mode} ===\n`);

  const db = initAdmin();
  const now = new Date();
  const timestamp = now.toISOString();

  const results = {
    total: CANDIDATES.length,
    alreadyArchived: 0,
    archivedNow: 0,
    skippedConfirmFirst: 0,
    notFound: 0,
    wouldArchive: 0,
  };

  for (const c of CANDIDATES) {
    const ref = db.collection(c.collection).doc(c.docId);
    const snap = await ref.get();

    if (!snap.exists) {
      console.log(`[NOT FOUND]   ${c.collection}/${c.docId}`);
      results.notFound++;
      continue;
    }

    const data = snap.data() as Record<string, unknown>;

    if (data.archived === true) {
      console.log(`[ALREADY OK]  ${c.collection}/${c.docId} (ya archivado el ${data.archivedAt})`);
      results.alreadyArchived++;
      continue;
    }

    if (c.action === 'confirm-first') {
      console.log(
        `[SKIP]        ${c.collection}/${c.docId} — requiere confirmación explícita Paloma/Noel: ${c.reason}`,
      );
      results.skippedConfirmFirst++;
      continue;
    }

    if (!apply) {
      console.log(`[WOULD ARCH]  ${c.collection}/${c.docId} — ${c.reason}`);
      results.wouldArchive++;
      continue;
    }

    await ref.update({
      archived: true,
      archivedAt: FieldValue.serverTimestamp(),
      archivedReason: c.reason,
      archivedBy: 'script:cleanup-test-data-fase-0',
      archivedAtIso: timestamp,
    });
    console.log(`[ARCHIVED]    ${c.collection}/${c.docId}`);
    results.archivedNow++;
  }

  console.log('\n=== Resumen ===');
  console.log(`Total candidatos:                ${results.total}`);
  console.log(`Ya archivados (no-op):           ${results.alreadyArchived}`);
  console.log(`Archivados en esta corrida:      ${results.archivedNow}`);
  console.log(`Requieren confirmación humana:   ${results.skippedConfirmFirst}`);
  console.log(`No encontrados:                  ${results.notFound}`);
  if (!apply) {
    console.log(`Habrían sido archivados:         ${results.wouldArchive}`);
    console.log('\nPara aplicar: pnpm tsx scripts/cleanup-test-data-fase-0.ts --apply');
  }
  console.log('');
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
