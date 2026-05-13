import xmlrpc from 'xmlrpc';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
for (const line of raw.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const url=process.env.ODOO_URL, db=process.env.ODOO_DB, user=process.env.ODOO_USERNAME, key=process.env.ODOO_API_KEY;
const common = xmlrpc.createSecureClient({url:`${url}/xmlrpc/2/common`});
const models = xmlrpc.createSecureClient({url:`${url}/xmlrpc/2/object`});
const call = (c,m,a)=>new Promise((r,j)=>c.methodCall(m,a,(e,v)=>e?j(e):r(v)));
const uid = await call(common,'authenticate',[db,user,key,{}]);
const rows = await call(models,'execute_kw',[db,uid,key,'account.payment','read',[[8060,8061]],{fields:['id','name','partner_id','amount','date','x_dup_status','x_canonical_payment_id']}]);
console.log(JSON.stringify(rows, null, 2));
process.exit(0);
