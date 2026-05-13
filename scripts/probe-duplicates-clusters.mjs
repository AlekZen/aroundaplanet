import xmlrpc from 'xmlrpc';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
for (const line of raw.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const url=process.env.ODOO_URL, db=process.env.ODOO_DB, user=process.env.ODOO_USERNAME, key=process.env.ODOO_API_KEY;
const common = xmlrpc.createSecureClient({ url: `${url}/xmlrpc/2/common` });
const models = xmlrpc.createSecureClient({ url: `${url}/xmlrpc/2/object` });
const call = (c,m,a) => new Promise((res,rej)=>c.methodCall(m,a,(e,v)=>e?rej(e):res(v)));
const t0 = Date.now();
const uid = await call(common,'authenticate',[db,user,key,{}]);
const t1 = Date.now();
const rows = await call(models,'execute_kw',[db,uid,key,'account.payment','search_read',[[['state','in',['draft','in_process','paid']]]],{fields:['id','memo','amount','date','partner_id','state','x_dup_status'], limit:500}]);
const t2 = Date.now();
console.log(`auth: ${t1-t0}ms  search_read 500: ${t2-t1}ms  rows: ${rows.length}`);

// Cluster manually por partner+amount±$1+date±3d
const key2 = r => `${r.partner_id?.[0]}|${Math.round(r.amount)}|${r.date}`;
const groups = {};
for (const r of rows) { const k = key2(r); (groups[k] ||= []).push(r); }
const clusters = Object.values(groups).filter(g => g.length > 1);
console.log(`clusters con >=2 pagos exactos (sin tolerance): ${clusters.length}`);
process.exit(0);
