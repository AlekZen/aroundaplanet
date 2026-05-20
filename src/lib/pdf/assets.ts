import { readFileSync } from 'node:fs'
import path from 'node:path'

let cachedLogo: Buffer | null = null

export function loadLogoBuffer(): Buffer {
  if (cachedLogo !== null) return cachedLogo
  try {
    cachedLogo = readFileSync(path.join(process.cwd(), 'src', 'lib', 'pdf', 'assets', 'logo-aroundaplanet.png'))
  } catch {
    cachedLogo = Buffer.alloc(0)
  }
  return cachedLogo
}

export function hasLogo(): boolean {
  return loadLogoBuffer().length > 0
}
