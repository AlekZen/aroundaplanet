import { readFileSync } from 'node:fs'
import path from 'node:path'

let cachedColor: Buffer | null = null
let cachedWhite: Buffer | null = null

function load(filename: string): Buffer {
  try {
    return readFileSync(path.join(process.cwd(), 'src', 'lib', 'pdf', 'assets', filename))
  } catch {
    return Buffer.alloc(0)
  }
}

export function loadLogoColorBuffer(): Buffer {
  if (cachedColor === null) cachedColor = load('logo-aroundaplanet-color.png')
  return cachedColor
}

export function loadLogoWhiteBuffer(): Buffer {
  if (cachedWhite === null) cachedWhite = load('logo-aroundaplanet-white.png')
  return cachedWhite
}

export function hasLogo(): boolean {
  return loadLogoColorBuffer().length > 0
}
