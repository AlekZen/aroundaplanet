/**
 * migrate-odoo-images-to-storage.mjs
 *
 * One-time migration: reads odooImageBase64 from Firestore trips,
 * uploads each to Firebase Storage as the first hero image,
 * and updates heroImages[] in Firestore.
 *
 * Usage: node scripts/migrate-odoo-images-to-storage.mjs [--dry-run]
 *
 * Requires: .keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json
 */

import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

const DRY_RUN = process.argv.includes('--dry-run')
const STORAGE_BASE_URL = 'https://storage.googleapis.com'

// --- Init Firebase Admin ---
const keyPath = '.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json'
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'))
const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'arounda-planet.firebasestorage.app',
})
const db = getFirestore(app)
const bucket = getStorage(app).bucket()

// --- Detect image type from base64 ---
function detectImageType(base64String) {
  // Check magic bytes from first few chars of base64
  if (base64String.startsWith('/9j/')) return { mime: 'image/jpeg', ext: 'jpg' }
  if (base64String.startsWith('iVBOR')) return { mime: 'image/png', ext: 'png' }
  if (base64String.startsWith('UklGR')) return { mime: 'image/webp', ext: 'webp' }
  if (base64String.startsWith('R0lGO')) return { mime: 'image/gif', ext: 'gif' }
  // Default to JPEG (most Odoo product images are JPEG)
  return { mime: 'image/jpeg', ext: 'jpg' }
}

// --- Main ---
async function main() {
  console.log(`\n=== Migrate odooImageBase64 -> Storage heroImages ===`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`)
  console.log('')

  // 1. Read all trips
  const snapshot = await db.collection('trips').get()
  console.log(`Total trips in Firestore: ${snapshot.size}`)

  let migrated = 0
  let skippedNoImage = 0
  let skippedHasHero = 0
  let errors = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const tripId = doc.id
    const tripName = data.odooName || tripId

    // Skip if no odooImageBase64
    if (!data.odooImageBase64 || typeof data.odooImageBase64 !== 'string' || data.odooImageBase64.length < 100) {
      skippedNoImage++
      continue
    }

    // Skip if already has hero images
    if (Array.isArray(data.heroImages) && data.heroImages.length > 0) {
      skippedHasHero++
      console.log(`  SKIP (has hero): ${tripName}`)
      continue
    }

    // Detect image type
    const { mime, ext } = detectImageType(data.odooImageBase64)
    const buffer = Buffer.from(data.odooImageBase64, 'base64')
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2)

    console.log(`  ${tripName}: ${sizeMB} MB (${mime})`)

    if (DRY_RUN) {
      migrated++
      continue
    }

    try {
      // Upload to Storage
      const filename = `odoo-original.${ext}`
      const storagePath = `trips/${tripId}/hero/${filename}`
      const fileRef = bucket.file(storagePath)

      await fileRef.save(buffer, {
        metadata: { contentType: mime },
      })
      await fileRef.makePublic()

      const publicUrl = `${STORAGE_BASE_URL}/${bucket.name}/${storagePath}`

      // Update Firestore
      await doc.ref.update({
        heroImages: FieldValue.arrayUnion(publicUrl),
        updatedAt: FieldValue.serverTimestamp(),
      })

      console.log(`    -> Uploaded: ${storagePath}`)
      migrated++
    } catch (err) {
      console.error(`    ERROR: ${tripName} - ${err.message}`)
      errors++
    }
  }

  console.log('\n=== Results ===')
  console.log(`  Migrated:         ${migrated}`)
  console.log(`  Skipped (no img): ${skippedNoImage}`)
  console.log(`  Skipped (has hero): ${skippedHasHero}`)
  console.log(`  Errors:           ${errors}`)
  console.log('')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
