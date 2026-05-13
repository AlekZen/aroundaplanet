import admin from 'firebase-admin';
import xmlrpc from 'xmlrpc';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const key = JSON.parse(readFileSync('.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json','utf8'));
admin.initializeApp({ credential: admin.credential.cert(key) });
const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
for (const line of raw.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
// Firestore: Felipe $5,000 7 ene 2026
const snap = await admin.firestore().collection('payments').where('bankReference','==','HSBC734948').get();
console.log(`Firestore payments con HSBC734948: ${snap.size}`);
snap.forEach(d=>{const x=d.data(); console.log(`  ${d.id}: status=${x.status} odooPaymentId=${x.odooPaymentId??'null'} odooSyncStatus=${x.odooSyncStatus??'null'} odooLastError=${(x.odooLastError||'').slice(0,200)}`);});

// Odoo: ir.model.data con prefijo payment_
const url=process.env.ODOO_URL, db=process.env.ODOO_DB, user=process.env.ODOO_USERNAME, key2=process.env.ODOO_API_KEY;
const common = xmlrpc.createSecureClient({url:`${url}/xmlrpc/2/common`});
const models = xmlrpc.createSecureClient({url:`${url}/xmlrpc/2/object`});
const call = (c,m,a)=>new Promise((r,j)=>c.methodCall(m,a,(e,v)=>e?j(e):r(v)));
const uid = await call(common,'authenticate',[db,user,key2,{}]);
const ids = snap.docs.map(d=>d.id);
for (const fsid of ids) {
  const imd = await call(models,'execute_kw',[db,uid,key2,'ir.model.data','search_read',[[['module','=','__aroundaplanet__'],['name','=',`payment_${fsid}`]]],{fields:['id','name','res_id','create_date']}]);
  console.log(`Odoo ir.model.data payment_${fsid}: ${imd.length} found`, imd[0]||'');
  if (imd[0]?.res_id > 0) {
    const pay = await call(models,'execute_kw',[db,uid,key2,'account.payment','read',[[imd[0].res_id]],{fields:['id','name','amount','date','state','x_firebase_payment_id','x_firebase_agent_uid']}]);
    console.log(`  → account.payment:`, pay[0]);
  }
}
process.exit(0);
