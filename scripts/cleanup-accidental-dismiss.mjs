import admin from 'firebase-admin';
import { readFileSync } from 'fs';
const key = JSON.parse(readFileSync('.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json','utf8'));
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();
// Eliminar el dismissal accidental del c_8060_8061 (cluster que sí es canónico real)
await db.collection('paymentDedupDismissals').doc('c_8060_8061').delete();
console.log('eliminado paymentDedupDismissals/c_8060_8061 (test cleanup)');
process.exit(0);
