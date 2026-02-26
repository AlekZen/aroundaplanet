/**
 * Seed permission documents to Firestore.
 * Run with: pnpm seed:permissions
 *
 * Uses Firebase Admin SDK (bypasses security rules).
 * In dev: reads credentials from .keys/
 * In prod: uses ADC (Application Default Credentials)
 */
import { adminDb } from '../src/lib/firebase/admin'
import { runSeed } from '../src/lib/auth/seedPermissions'

async function main() {
  console.log('Seeding permissions to Firestore...')

  try {
    await runSeed(adminDb)
    console.log('Permissions seeded successfully for 5 roles.')
  } catch (error) {
    console.error('Failed to seed permissions:', error)
    process.exit(1)
  }

  process.exit(0)
}

main()
