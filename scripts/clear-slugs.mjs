import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, '../.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json'), 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function clearSlugs() {
  const trips = await db.collection('trips').where('isPublished', '==', true).get();
  let cleared = 0;
  for (const doc of trips.docs) {
    const data = doc.data();
    if (data.slug) {
      await doc.ref.update({ slug: '' });
      console.log('Cleared:', doc.id, data.slug);
      cleared++;
    }
  }
  console.log('\nCleared ' + cleared + ' slugs');
}

clearSlugs().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
