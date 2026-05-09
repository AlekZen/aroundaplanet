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

function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function assignSlugs() {
  const trips = await db.collection('trips').where('isPublished', '==', true).get();
  const slugMap = new Map();
  const updates = [];

  trips.forEach(doc => {
    const d = doc.data();
    if (!d.slug || d.slug === '') {
      let slug = generateSlug(d.odooName || doc.id);
      let finalSlug = slug;
      let counter = 2;
      while (slugMap.has(finalSlug)) {
        finalSlug = slug + '-' + counter;
        counter++;
      }
      slugMap.set(finalSlug, doc.id);
      updates.push({ id: doc.id, name: d.odooName, slug: finalSlug });
    } else {
      slugMap.set(d.slug, doc.id);
      console.log('ALREADY HAS SLUG:', doc.id, d.slug);
    }
  });

  console.log('Slugs to assign:', updates.length);
  console.log('');

  for (const u of updates) {
    await db.collection('trips').doc(u.id).update({ slug: u.slug });
    console.log(u.id + ' -> ' + u.slug);
  }

  console.log('\nDone! ' + updates.length + ' trips updated.');
}

assignSlugs().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
