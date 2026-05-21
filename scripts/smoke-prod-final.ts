/* eslint-disable no-console */
import { Agent, setGlobalDispatcher } from "undici";
setGlobalDispatcher(
  new Agent({ connect: { timeout: 60000 }, headersTimeout: 60000, bodyTimeout: 60000 }),
);
const BASE = "https://aroundaplanet--arounda-planet.us-east4.hosted.app";

type Check = {
  path: string;
  status: number;
  mime: RegExp;
  fallback?: string;
};

const checks: Check[] = [
  { path: "/", status: 200, mime: /text\/html/i },
  { path: "/favicon.ico", status: 200, mime: /image\/(x-icon|vnd\.microsoft\.icon)/i },
  { path: "/apple-touch-icon.png", status: 200, mime: /image\/png/i },
  { path: "/og-image.png", status: 200, mime: /image\/png/i },
  { path: "/icons/icon-512x512.png", status: 200, mime: /image\/png/i },
  { path: "/images/aroundaplanet-logo.png", status: 200, mime: /image\/png/i },
  { path: "/api/agent/client-payments", status: 401, mime: /application\/json/i },
  { path: "/api/payments/test/receipt-pdf", status: 401, mime: /application\/json/i },
  { path: "/api/agent/orders-contract-map", status: 401, mime: /application\/json/i },
  { path: "/api/admin/orders/orphan", status: 401, mime: /application\/json/i },
  { path: "/api/admin/agents-list", status: 401, mime: /application\/json/i },
  {
    path: "/manifest.webmanifest",
    status: 200,
    mime: /application\/(manifest\+json|json)/i,
    fallback: "/manifest.json",
  },
];

type Row = {
  endpoint: string;
  status: string;
  ctype: string;
  verdict: string;
};

async function probe(path: string): Promise<{ status: number; ctype: string }> {
  const url = BASE + path;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", redirect: "manual", signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
  return {
    status: res.status,
    ctype: res.headers.get("content-type") ?? "",
  };
}

async function main() {
  const rows: Row[] = [];
  let allOk = true;

  for (const c of checks) {
    let { status, ctype } = await probe(c.path);
    let usedPath = c.path;
    if (c.fallback && status !== c.status) {
      const r2 = await probe(c.fallback);
      if (r2.status === c.status) {
        status = r2.status;
        ctype = r2.ctype;
        usedPath = c.fallback;
      }
    }
    const ok = status === c.status && c.mime.test(ctype);
    if (!ok) allOk = false;
    rows.push({
      endpoint: usedPath,
      status: String(status),
      ctype: ctype || "(none)",
      verdict: ok ? "OK" : "MISMATCH",
    });
  }

  const w1 = Math.max(8, ...rows.map((r) => r.endpoint.length));
  const w2 = 6;
  const w3 = Math.max(12, ...rows.map((r) => r.ctype.length));
  const w4 = 8;
  const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));

  console.log(
    pad("endpoint", w1) + " | " + pad("status", w2) + " | " + pad("content-type", w3) + " | " + pad("verdict", w4),
  );
  console.log("-".repeat(w1 + w2 + w3 + w4 + 9));
  for (const r of rows) {
    console.log(pad(r.endpoint, w1) + " | " + pad(r.status, w2) + " | " + pad(r.ctype, w3) + " | " + pad(r.verdict, w4));
  }
  console.log("");
  console.log("Veredicto global: " + (allOk ? "OK (todos los endpoints pasaron)" : "FAIL (al menos un mismatch)"));
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
