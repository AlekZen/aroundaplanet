/**
 * Genera dos variantes optimizadas del logo oficial para uso en PDFs:
 *   - logo-aroundaplanet-color.png  → wordmark con colores originales (sobre fondo claro)
 *   - logo-aroundaplanet-white.png  → wordmark monocromo blanco (sobre fondo oscuro)
 *
 * Ambas se recortan al bounding box real del wordmark (sharp trim sobre el alfa) y
 * se redimensionan a ~512px de ancho con compresión palette para mantener bytes bajos.
 *
 * Regenerar cuando el cliente entregue un nuevo asset oficial:
 *   pnpm tsx scripts/generate-pdf-logo-variants.ts
 *
 * Sharp no resuelve desde la raíz por pnpm hoisting; importamos desde el path absoluto
 * del módulo en .pnpm.
 */
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharpModulePath = path.join(
  process.cwd(),
  'node_modules',
  '.pnpm',
  'sharp@0.34.5',
  'node_modules',
  'sharp'
)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const sharp: any = require(sharpModulePath)

const SOURCE = path.join(process.cwd(), 'public', 'images', 'aroundaplanet-logo.png')
const OUT_DIR = path.join(process.cwd(), 'src', 'lib', 'pdf', 'assets')
const OUT_COLOR = path.join(OUT_DIR, 'logo-aroundaplanet-color.png')
const OUT_WHITE = path.join(OUT_DIR, 'logo-aroundaplanet-white.png')

const TARGET_WIDTH = 512

async function generateColor(): Promise<{ size: number; w: number; h: number }> {
  const info = await sharp(SOURCE)
    .trim()
    .resize({ width: TARGET_WIDTH, withoutEnlargement: false })
    .png({ compressionLevel: 9, palette: true })
    .toFile(OUT_COLOR)
  return { size: info.size, w: info.width, h: info.height }
}

async function generateWhite(): Promise<{ size: number; w: number; h: number }> {
  const trimmed = await sharp(SOURCE)
    .trim()
    .resize({ width: TARGET_WIDTH, withoutEnlargement: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { data, info } = trimmed
  const out = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]!
    out[i] = 255
    out[i + 1] = 255
    out[i + 2] = 255
    out[i + 3] = alpha
  }

  const final = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(OUT_WHITE)
  return { size: final.size, w: final.width, h: final.height }
}

async function main() {
  const color = await generateColor()
  const white = await generateWhite()
  console.log(`color : ${color.w}x${color.h} · ${(color.size / 1024).toFixed(1)} KB → ${OUT_COLOR}`)
  console.log(`white : ${white.w}x${white.h} · ${(white.size / 1024).toFixed(1)} KB → ${OUT_WHITE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
