import xmlrpc from 'xmlrpc';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
for (const line of raw.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const url=process.env.ODOO_URL, db=process.env.ODOO_DB, user=process.env.ODOO_USERNAME, key=process.env.ODOO_API_KEY;
const common = xmlrpc.createSecureClient({url:`${url}/xmlrpc/2/common`});
const models = xmlrpc.createSecureClient({url:`${url}/xmlrpc/2/object`});
const call = (c,m,a)=>new Promise((r,j)=>c.methodCall(m,a,(e,v)=>e?j(e):r(v)));
const uid = await call(common,'authenticate',[db,user,key,{}]);
const inv = {};
inv.ts = new Date().toISOString();

inv.payments_TEST = await call(models,'execute_kw',[db,uid,key,'account.payment','search_read',[[['name','like','TEST_AROUNDA']]],{fields:['id','name','state','amount','create_date']}]);
inv.payments_CLEANED = await call(models,'execute_kw',[db,uid,key,'account.payment','search_read',[[['name','like','_CLEANED_']]],{fields:['id','name','state','amount','create_date']}]);
inv.attachments_TEST = await call(models,'execute_kw',[db,uid,key,'ir.attachment','search_read',[[['name','like','TEST_AROUNDA']]],{fields:['id','name','create_date','res_model','res_id']}]);
inv.attachments_CLEANED = await call(models,'execute_kw',[db,uid,key,'ir.attachment','search_read',[[['name','like','_CLEANED_']]],{fields:['id','name','create_date']}]);
inv.irmodeldata_TEST = await call(models,'execute_kw',[db,uid,key,'ir.model.data','search_read',[[['module','=','__aroundaplanet__']]],{fields:['id','name','model','res_id','create_date']}]);

console.log(`payments_TEST: ${inv.payments_TEST.length}`);
console.log(`payments_CLEANED: ${inv.payments_CLEANED.length}`);
console.log(`attachments_TEST: ${inv.attachments_TEST.length}`);
console.log(`attachments_CLEANED: ${inv.attachments_CLEANED.length}`);
console.log(`ir.model.data __aroundaplanet__: ${inv.irmodeldata_TEST.length}`);

writeFileSync('scripts/audit-output/test-arounda-inventory.json', JSON.stringify(inv, null, 2));
console.log('saved scripts/audit-output/test-arounda-inventory.json');
process.exit(0);
