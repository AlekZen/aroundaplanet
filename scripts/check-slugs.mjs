/**
 * Quick script to check trip slugs in Firestore and set one for testing
 * Usage: node scripts/check-slugs.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const keyPath = join(__dirname, '..', '.keys', 'arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json')
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'))

const app = initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore(app)

async function main() {
  const snapshot = await db.collection('trips').where('isPublished', '==', true).get()

  console.log(`Total published trips: ${snapshot.size}\n`)

  const withSlugs = []
  const withoutSlugs = []

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const info = { id: doc.id, name: data.odooName, slug: data.slug || null }
    if (data.slug) {
      withSlugs.push(info)
    } else {
      withoutSlugs.push(info)
    }
  }

  console.log(`Trips WITH slug: ${withSlugs.length}`)
  for (const t of withSlugs) {
    console.log(`  - ${t.name} => slug: "${t.slug}" (id: ${t.id})`)
  }

  console.log(`\nTrips WITHOUT slug: ${withoutSlugs.length}`)
  for (const t of withoutSlugs.slice(0, 5)) {
    console.log(`  - ${t.name} (id: ${t.id})`)
  }
  if (withoutSlugs.length > 5) {
    console.log(`  ... and ${withoutSlugs.length - 5} more`)
  }

  // If no trip has a slug, set one for testing
  if (withSlugs.length === 0 && withoutSlugs.length > 0) {
    // Pick "VUELTA AL MUNDO 2025" or first trip
    const target = withoutSlugs.find(t => t.name.includes('VUELTA AL MUNDO')) || withoutSlugs[0]
    const slug = target.name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    console.log(`\nSetting slug "${slug}" on trip "${target.name}" (id: ${target.id})...`)
    await db.collection('trips').doc(target.id).update({ slug })
    console.log('Done!')

    // Also set slugs for 2 more trips for testing variety
    const extras = withoutSlugs.filter(t => t.id !== target.id).slice(0, 2)
    for (const extra of extras) {
      const extraSlug = extra.name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      console.log(`Setting slug "${extraSlug}" on trip "${extra.name}" (id: ${extra.id})...`)
      await db.collection('trips').doc(extra.id).update({ slug: extraSlug })
      console.log('Done!')
    }
  }
}

main().catch(console.error).finally(() => process.exit(0))
