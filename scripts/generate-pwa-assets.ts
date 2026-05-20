/**
 * Genera las variantes PWA + favicon + OG image desde el logo oficial.
 *   - PWA icons: public/icons/icon-{72,192,512}.png + icon-512-maskable.png
 *   - favicon.ico multi-resolución (16/32/48) en public/favicon.ico
 *   - apple-touch-icon.png 180×180 en public/apple-touch-icon.png
 *   - og-image.png 1200×630 en public/og-image.png
 *
 * Sharp se importa desde el path absoluto de .pnpm (hoisting).
 * Regenerar al cambiar el logo oficial:
 *   pnpm tsx scripts/generate-pwa-assets.ts
 */
import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharpPath = path.join(
  process.cwd(),
  'node_modules',
  '.pnpm',
  'sharp@0.34.5',
  'node_modules',
  'sharp'
)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const sharp: any = require(sharpPath)

const SOURCE = path.join(process.cwd(), 'public', 'images', 'aroundaplanet-logo.png')
const PUBLIC = path.join(process.cwd(), 'public')
const ICONS_DIR = path.join(PUBLIC, 'icons')

// Paleta marca AroundaPlanet (consistente con manifest.ts y design system)
const BG_BRAND = { r: 27, g: 67, b: 50 } // #1B4332 verde primario
const BG_WHITE = { r: 255, g: 255, b: 255 }

/**
 * Genera un icono cuadrado del logo con padding fijo, fondo blanco
 * (mejor compat iOS). Mantiene el isotipo legible.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function squareIcon(size: number, outPath: string, paddingRatio = 0.12, bg: any = BG_WHITE) {
  const inner = Math.round(size * (1 - paddingRatio * 2))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logoBuffer: Buffer = await sharp(SOURCE).trim().resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  const info = await sharp({
    create: { width: size, height: size, channels: 4, background: { ...bg, alpha: 1 } },
  })
    .composite([{ input: logoBuffer, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: false })
    .toFile(outPath)
  console.log(`icon ${size}x${size} · ${(info.size / 1024).toFixed(1)} KB → ${path.relative(process.cwd(), outPath)}`)
}

/**
 * Maskable icon: safe area de 20% según spec PWA, fondo color marca + logo BLANCO
 * (el logo color teal/navy no contrasta sobre el verde).
 */
async function maskableIcon(size: number, outPath: string) {
  const logoWhitePath = path.join(process.cwd(), 'src', 'lib', 'pdf', 'assets', 'logo-aroundaplanet-white.png')
  const padding = 0.2
  const inner = Math.round(size * (1 - padding * 2))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logo: Buffer = await sharp(logoWhitePath).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  const info = await sharp({
    create: { width: size, height: size, channels: 4, background: { ...BG_BRAND, alpha: 1 } },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath)
  console.log(`maskable ${size}x${size} · ${(info.size / 1024).toFixed(1)} KB → ${path.relative(process.cwd(), outPath)}`)
}

/**
 * Construye un favicon.ico multi-resolución (16/32/48) con tres PNG embebidos.
 * Spec ICO: header 6 bytes + N entradas de 16 bytes + N PNGs concatenados.
 */
async function buildFaviconIco(outPath: string) {
  const sizes = [16, 32, 48]
  const pngs: Buffer[] = []
  for (const sz of sizes) {
    const inner = Math.max(1, Math.round(sz * 0.78))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logo: Buffer = await sharp(SOURCE).trim().resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pngBuf: Buffer = await sharp({
      create: { width: sz, height: sz, channels: 4, background: { ...BG_WHITE, alpha: 1 } },
    })
      .composite([{ input: logo, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toBuffer()
    pngs.push(pngBuf)
  }

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // ICO type
  header.writeUInt16LE(sizes.length, 4) // image count

  const entries: Buffer[] = []
  let offset = 6 + 16 * sizes.length
  for (let i = 0; i < sizes.length; i++) {
    const sz = sizes[i]!
    const png = pngs[i]!
    const entry = Buffer.alloc(16)
    entry.writeUInt8(sz === 256 ? 0 : sz, 0) // width (0 = 256)
    entry.writeUInt8(sz === 256 ? 0 : sz, 1) // height
    entry.writeUInt8(0, 2) // palette colors
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(png.length, 8) // size
    entry.writeUInt32LE(offset, 12) // offset
    entries.push(entry)
    offset += png.length
  }

  const ico = Buffer.concat([header, ...entries, ...pngs])
  await writeFile(outPath, ico)
  console.log(`favicon.ico ${sizes.join('/')} · ${(ico.length / 1024).toFixed(1)} KB → ${path.relative(process.cwd(), outPath)}`)
}

/**
 * OG image 1200×630 — fondo verde marca, logo blanco a la izquierda + tagline.
 * El logo blanco se reutiliza del Batch B PDF helper.
 */
async function buildOgImage(outPath: string) {
  const logoWhitePath = path.join(process.cwd(), 'src', 'lib', 'pdf', 'assets', 'logo-aroundaplanet-white.png')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logoWhite: Buffer = await sharp(logoWhitePath).resize(560, undefined, { fit: 'contain' }).png().toBuffer()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta: any = await sharp(logoWhite).metadata()
  const logoH: number = meta.height ?? 180
  const logoW: number = meta.width ?? 560

  const accent = '#F4A261'
  const taglineSvg = Buffer.from(
    `<svg width="500" height="200" xmlns="http://www.w3.org/2000/svg">
      <style>
        .brand { font-family: 'Helvetica', sans-serif; font-weight: 700; fill: #FFFFFF; }
        .tagline { font-family: 'Helvetica', sans-serif; font-weight: 400; fill: #FFFFFF; opacity: 0.85; }
        .accent { fill: ${accent}; }
      </style>
      <text x="0" y="60" class="brand" font-size="42">TRAVEL AGENCY</text>
      <text x="0" y="115" class="tagline" font-size="22">Vuelta al Mundo</text>
      <text x="0" y="148" class="tagline" font-size="22">en 33.8 días</text>
      <rect x="0" y="170" width="80" height="4" class="accent" />
    </svg>`
  )

  const info = await sharp({
    create: { width: 1200, height: 630, channels: 4, background: { ...BG_BRAND, alpha: 1 } },
  })
    .composite([
      { input: logoWhite, left: 80, top: Math.round((630 - logoH) / 2) - 30 },
      { input: taglineSvg, left: 80 + logoW + 50, top: Math.round((630 - 200) / 2) },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outPath)
  console.log(`og-image 1200x630 · ${(info.size / 1024).toFixed(1)} KB → ${path.relative(process.cwd(), outPath)}`)
}

async function main() {
  await squareIcon(72, path.join(ICONS_DIR, 'icon-72x72.png'))
  await squareIcon(192, path.join(ICONS_DIR, 'icon-192x192.png'))
  await squareIcon(512, path.join(ICONS_DIR, 'icon-512x512.png'))
  await maskableIcon(512, path.join(ICONS_DIR, 'icon-512x512-maskable.png'))
  await squareIcon(180, path.join(PUBLIC, 'apple-touch-icon.png'))
  await buildFaviconIco(path.join(PUBLIC, 'favicon.ico'))
  await buildOgImage(path.join(PUBLIC, 'og-image.png'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
