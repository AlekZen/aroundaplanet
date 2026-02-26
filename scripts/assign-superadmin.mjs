import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { createRequire } from 'module'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const serviceAccount = require(join(__dirname, '..', '.keys', 'arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json'))

const app = initializeApp({ credential: cert(serviceAccount) })
const auth = getAuth(app)
const db = getFirestore(app)

const EMAIL = 'ocompudoc@gmail.com'

async function main() {
  const user = await auth.getUserByEmail(EMAIL)
  console.log('UID:', user.uid)
  console.log('Current claims:', JSON.stringify(user.customClaims))

  // Set SuperAdmin claims
  await auth.setCustomClaims(user.uid, {
    roles: ['cliente', 'superadmin'],
    adminLevel: 5,
  })
  console.log('Custom claims SET to superadmin')

  // Verify
  const updated = await auth.getUserByEmail(EMAIL)
  console.log('New claims:', JSON.stringify(updated.customClaims))

  // Ensure Firestore user doc also has superadmin role
  const userDoc = await db.collection('users').doc(user.uid).get()
  if (userDoc.exists) {
    const data = userDoc.data()
    console.log('Firestore roles:', JSON.stringify(data.roles))
    const hasSuper = data.roles && data.roles.includes('superadmin')
    if (!hasSuper) {
      const newRoles = [...new Set([...(data.roles || ['cliente']), 'superadmin'])]
      await db.collection('users').doc(user.uid).update({ roles: newRoles })
      console.log('Firestore roles updated to:', JSON.stringify(newRoles))
    } else {
      console.log('Firestore roles already include superadmin')
    }
  } else {
    console.log('WARNING: No Firestore user doc found')
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
