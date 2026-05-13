/**
 * Cross-match script: compara pagos Firestore vs Odoo (account.payment + documents).
 * NO escribe nada. Solo análisis sobre los JSON ya generados.
 *
 * Ejecutar: pnpm tsx scripts/audit-output/cross-match-payments.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIRESTORE_PATH = path.join(HERE, "firestore-real-data.json");
const ODOO_PATH = path.join(HERE, "odoo-real-data.json");
const OUT_PATH = path.join(HERE, "cross-match-result.json");

// ---------- Tipos mínimos ----------
type FirestorePayment = {
  paymentId: string;
  orderId: string;
  amountCents: number;
  paymentMethod: string;
  date: { _seconds: number; _nanoseconds: number } | string | null;
  status: string;
  agentId: string | null;
  agentName: string | null;
  clientId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  tripName: string | null;
  bankName: string | null;
  bankReference: string | null;
  concept: string | null;
  sourceAccount: string | null;
  destinationAccount: string | null;
  notes: string | null;
  receiptUrl: string | null;
  odooPaymentId: number | null;
  syncedToOdoo: boolean;
  registeredBy: string | null;
  createdAt: string;
  verifiedAt: string | null;
  updatedAt: string;
};

type OdooPayment = {
  id: number;
  partner: string | null;
  partnerId: number | null;
  amount: number;
  date: string; // YYYY-MM-DD
  create_date: string;
  journal: string | null;
  pml: string | null;
  memo: string | null;
  state: string;
  reconciledCount: number;
  payment_type: string;
};

type OdooDocument = {
  id: number;
  name: string;
  mimetype: string | null;
  folder: string | null;
  folderId: number | null;
  partner: string | null;
  owner: string | null;
  create_date: string;
};

type OdooFolder = {
  id: number;
  name: string;
  parent: string | null;
};

// ---------- Utils ----------
function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((t) => t.length >= 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function firestoreDateToYMD(d: FirestorePayment["date"]): string | null {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  if (typeof d === "object" && "_seconds" in d) {
    return new Date(d._seconds * 1000).toISOString().slice(0, 10);
  }
  return null;
}

function dayDiff(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.abs(Math.round((da - db) / 86_400_000));
}

// ---------- Cargar datos ----------
const firestoreRaw = JSON.parse(fs.readFileSync(FIRESTORE_PATH, "utf8"));
const odooRaw = JSON.parse(fs.readFileSync(ODOO_PATH, "utf8"));

const firestorePayments: FirestorePayment[] = firestoreRaw.payments ?? [];
const odooPayments: OdooPayment[] = odooRaw.paymentsAll ?? odooRaw.paymentsSample ?? [];
const odooDocuments: OdooDocument[] = odooRaw.documentsAll ?? odooRaw.documentsSample ?? [];
const odooFolders: OdooFolder[] = odooRaw.foldersAll
  ? odooRaw.foldersAll.map((f: any) => ({ id: f.id, name: f.name, parent: f.parentName }))
  : [
      ...(odooRaw.folderNameSamples ?? []),
      ...(odooRaw.topFolders ?? []).map((f: any) => ({
        id: f.folderId,
        name: f.name,
        parent: f.parentName,
      })),
    ];

// De-dup folders por id
const folderById = new Map<number, OdooFolder>();
for (const f of odooFolders) {
  if (f && typeof f.id === "number") folderById.set(f.id, f);
}
const allFolders = Array.from(folderById.values());

// ---------- Matching ----------
type Match = {
  firestoreId: string;
  odooId: number;
  partner: string;
  amount: number;
  date: string;
  dateDiff: number;
  amountDiff: number;
  documentFolderId: number | null;
  documentFolderName: string | null;
  documentFileId: number | null;
  documentFileName: string | null;
  confidence: "high" | "medium" | "low";
  reasons: string[];
};

const matches: Match[] = [];
const firestoreOnly: any[] = [];
const odooMatched = new Set<number>();

for (const fp of firestorePayments) {
  const fpAmount = fp.amountCents / 100;
  const fpDate = firestoreDateToYMD(fp.date);
  const fpPartner = normalize(fp.clientName);
  const fpTokens = tokenSet(fp.clientName ?? "");

  let best: { op: OdooPayment; score: number; partnerOk: boolean; amountOk: boolean; dateOk: boolean; jac: number; amtDiff: number; dDiff: number } | null = null;

  for (const op of odooPayments) {
    const opTokens = tokenSet(op.partner ?? "");
    const jac = jaccard(fpTokens, opTokens);
    const partnerOk = jac >= 0.5 || normalize(op.partner) === fpPartner;
    const amtDiff = Math.abs(fpAmount - op.amount);
    const amountOk = amtDiff <= 1;
    const dDiff = fpDate && op.date ? dayDiff(fpDate, op.date) : 999;
    const dateOk = dDiff <= 3;
    const score = (partnerOk ? 1 : 0) + (amountOk ? 1 : 0) + (dateOk ? 1 : 0);
    if (!best || score > best.score || (score === best.score && jac > best.jac)) {
      best = { op, score, partnerOk, amountOk, dateOk, jac, amtDiff, dDiff };
    }
  }

  if (!best || best.score === 0) {
    firestoreOnly.push({
      firestoreId: fp.paymentId,
      partner: fp.clientName,
      amount: fpAmount,
      date: fpDate,
      tripName: fp.tripName,
      status: fp.status,
      reason: "Sin candidato en muestra Odoo (puede ser pago test o fuera del sample de 30)",
    });
    continue;
  }

  // Buscar folder candidato por tripName
  const tripTokens = tokenSet(fp.tripName ?? "");
  let folderHit: OdooFolder | null = null;
  let bestFolderJac = 0;
  for (const f of allFolders) {
    const fTokens = tokenSet(f.name);
    const jac = jaccard(tripTokens, fTokens);
    if (jac > bestFolderJac) {
      bestFolderJac = jac;
      folderHit = f;
    }
  }
  if (bestFolderJac < 0.4) folderHit = null;

  // Buscar archivo dentro de carpeta por partner
  let docHit: OdooDocument | null = null;
  if (folderHit) {
    let bestDocJac = 0;
    for (const d of odooDocuments) {
      if (d.folderId !== folderHit.id) continue;
      const dTokens = tokenSet(d.name.replace(/\.[a-z0-9]+$/i, ""));
      const jac = jaccard(fpTokens, dTokens);
      if (jac > bestDocJac) {
        bestDocJac = jac;
        docHit = d;
      }
    }
    if (bestDocJac < 0.4) docHit = null;
  }

  const conf: Match["confidence"] = best.score === 3 ? "high" : best.score === 2 ? "medium" : "low";

  matches.push({
    firestoreId: fp.paymentId,
    odooId: best.op.id,
    partner: `${fp.clientName} ⇔ ${best.op.partner}`,
    amount: fpAmount,
    date: fpDate ?? "?",
    dateDiff: best.dDiff,
    amountDiff: best.amtDiff,
    documentFolderId: folderHit?.id ?? null,
    documentFolderName: folderHit?.name ?? null,
    documentFileId: docHit?.id ?? null,
    documentFileName: docHit?.name ?? null,
    confidence: conf,
    reasons: [
      best.partnerOk ? `partner✓(jac=${best.jac.toFixed(2)})` : `partner✗(jac=${best.jac.toFixed(2)})`,
      best.amountOk ? `amount✓(Δ=${best.amtDiff.toFixed(2)})` : `amount✗(Δ=${best.amtDiff.toFixed(2)})`,
      best.dateOk ? `date✓(Δ=${best.dDiff}d)` : `date✗(Δ=${best.dDiff}d)`,
    ],
  });
  if (conf !== "low") odooMatched.add(best.op.id);
}

// Pagos Odoo no matcheados
const odooOnly = odooPayments
  .filter((op) => !odooMatched.has(op.id))
  .map((op) => ({
    odooId: op.id,
    partner: op.partner,
    amount: op.amount,
    date: op.date,
    journal: op.journal,
    memo: op.memo,
    state: op.state,
  }));

// Duplicados internos Firestore: mismo partner+amount±$1+date±3d
const duplicatesInternalFirestore: any[] = [];
for (let i = 0; i < firestorePayments.length; i++) {
  for (let j = i + 1; j < firestorePayments.length; j++) {
    const a = firestorePayments[i];
    const b = firestorePayments[j];
    const aD = firestoreDateToYMD(a.date);
    const bD = firestoreDateToYMD(b.date);
    if (!aD || !bD) continue;
    const partnerSame = jaccard(tokenSet(a.clientName ?? ""), tokenSet(b.clientName ?? "")) >= 0.7;
    const amtSame = Math.abs(a.amountCents - b.amountCents) <= 100;
    const dateSame = dayDiff(aD, bD) <= 3;
    if (partnerSame && amtSame && dateSame) {
      duplicatesInternalFirestore.push({
        a: { id: a.paymentId, partner: a.clientName, amount: a.amountCents / 100, date: aD },
        b: { id: b.paymentId, partner: b.clientName, amount: b.amountCents / 100, date: bD },
      });
    }
  }
}

// Duplicados internos Odoo
const duplicatesInternalOdoo: any[] = [];
for (let i = 0; i < odooPayments.length; i++) {
  for (let j = i + 1; j < odooPayments.length; j++) {
    const a = odooPayments[i];
    const b = odooPayments[j];
    const partnerSame = jaccard(tokenSet(a.partner ?? ""), tokenSet(b.partner ?? "")) >= 0.7;
    const amtSame = Math.abs(a.amount - b.amount) <= 1;
    const dateSame = a.date && b.date && dayDiff(a.date, b.date) <= 3;
    if (partnerSame && amtSame && dateSame) {
      duplicatesInternalOdoo.push({
        a: { id: a.id, partner: a.partner, amount: a.amount, date: a.date, journal: a.journal },
        b: { id: b.id, partner: b.partner, amount: b.amount, date: b.date, journal: b.journal },
      });
    }
  }
}

// Carpetas con nombres parecidos (posibles duplicadas)
const folderClusters: Record<string, OdooFolder[]> = {};
for (const f of allFolders) {
  const key = normalize(f.name).split(" ").slice(0, 2).join(" ");
  if (!key) continue;
  (folderClusters[key] ??= []).push(f);
}
const folderDuplicates = Object.entries(folderClusters)
  .filter(([, arr]) => arr.length > 1)
  .map(([key, arr]) => ({
    key,
    folders: arr.map((f) => {
      const top = (odooRaw.topFolders ?? []).find((t: any) => t.folderId === f.id);
      return { id: f.id, name: f.name, parent: f.parent, fileCount: top?.fileCount ?? null };
    }),
  }));

const summary = {
  firestoreTotal: firestorePayments.length,
  odooSampleTotal: odooPayments.length,
  odooFullCount: odooRaw.counts?.payments ?? null,
  matchesHigh: matches.filter((m) => m.confidence === "high").length,
  matchesMedium: matches.filter((m) => m.confidence === "medium").length,
  matchesLow: matches.filter((m) => m.confidence === "low").length,
  firestoreOnly: firestoreOnly.length,
  odooOnly: odooOnly.length,
  duplicatesInternalFirestore: duplicatesInternalFirestore.length,
  duplicatesInternalOdoo: duplicatesInternalOdoo.length,
  folderDuplicateClusters: folderDuplicates.length,
};

const out = {
  generatedAt: new Date().toISOString(),
  summary,
  matches,
  firestoreOnly,
  odooOnly,
  duplicatesInternalFirestore,
  duplicatesInternalOdoo,
  folderDuplicates,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), "utf8");
console.log("Resumen:", JSON.stringify(summary, null, 2));
console.log(`\nResultado escrito en ${OUT_PATH}`);
