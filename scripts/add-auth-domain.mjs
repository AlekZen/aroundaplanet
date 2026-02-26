import admin from 'firebase-admin'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const keyPath = join(__dirname, '..', '.keys', 'arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json')
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'))

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'arounda-planet'
})

const NEW_DOMAIN = 'aroundaplanet--arounda-planet.us-east4.hosted.app'

async function main() {
  const tokenResult = await app.options.credential.getAccessToken()
  const token = tokenResult.access_token

  // Get current config
  const getRes = await fetch(
    'https://identitytoolkit.googleapis.com/admin/v2/projects/arounda-planet/config',
    { headers: { 'Authorization': `Bearer ${token}` } }
  )
  const config = await getRes.json()
  const domains = config.authorizedDomains || []

  console.log('Current domains:', domains)

  if (domains.includes(NEW_DOMAIN)) {
    console.log('Domain already authorized!')
    process.exit(0)
  }

  domains.push(NEW_DOMAIN)

  // Update config
  const patchRes = await fetch(
    'https://identitytoolkit.googleapis.com/admin/v2/projects/arounda-planet/config?updateMask=authorizedDomains',
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ authorizedDomains: domains })
    }
  )
  const result = await patchRes.json()
  console.log('Updated domains:', result.authorizedDomains)
}

main().catch(e => { console.error(e); process.exit(1) })
