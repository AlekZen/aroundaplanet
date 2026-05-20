# Smoke 7.1.3 — PWA icons + favicon + OpenGraph

Fecha: 2026-05-20

## Qué se generó

Script reproducible `scripts/generate-pwa-assets.ts` (sharp) deriva 7 assets desde `public/images/aroundaplanet-logo.png`:

| Asset | Tamaño bytes | Dimensiones | Variante |
|---|---|---|---|
| `public/icons/icon-72x72.png` | 2.4 KB | 72×72 | logo color sobre blanco, padding 12% |
| `public/icons/icon-192x192.png` | 10.3 KB | 192×192 | logo color sobre blanco, padding 12% |
| `public/icons/icon-512x512.png` | 36.3 KB | 512×512 | logo color sobre blanco, padding 12%, `purpose: any` |
| `public/icons/icon-512x512-maskable.png` | 15.7 KB | 512×512 | **logo blanco** sobre verde #1B4332, padding 20% safe-area, `purpose: maskable` |
| `public/apple-touch-icon.png` | 9.4 KB | 180×180 | logo color sobre blanco, padding 12% |
| `public/favicon.ico` | 2.3 KB | 16/32/48 multi-res | ICO real (ICONDIR + 3 PNGs embedded) |
| `public/og-image.png` | 44.3 KB | 1200×630 | fondo verde marca, logo blanco izquierda, "TRAVEL AGENCY · Vuelta al Mundo en 33.8 días" derecha + barra accent naranja |

## Manifest + metadata HTML

- `src/app/manifest.ts` — actualizado: maskable apunta al asset dedicado, agregado `apple-touch-icon`.
- `src/app/layout.tsx` — metadata enriquecida con `icons.icon[]`, `icons.apple`, `icons.shortcut`, `openGraph.images` (1200×630), `twitter.card='summary_large_image'`.
- `src/lib/metadata.ts` — `DEFAULT_OG_IMAGE` cambiado de `/images/hero/hero-group-photo-01.webp` a `/og-image.png` (afecta todas las páginas que usan `createMetadata()` — landing pública, viajes, sobre nosotros, etc).

## Bug detectado y resuelto durante smoke

El proxy `src/proxy.ts` matcher excluía `manuals|icons|images|favicon.ico|manifest.webmanifest` pero NO `apple-touch-icon.png` ni `og-image.png` (archivos sueltos en raíz de public/). Resultado: 307 redirect → ambos rotos cuando los navegadores los intentaban descargar.

Fix: agregar `apple-touch-icon.png|og-image.png` al matcher. Mismo patrón que el bug del Batch A con el logo oficial. Documentado en memoria.

## Probes HTTP local

```
/favicon.ico        → HTTP 200 image/x-icon         2377 B
/og-image.png       → HTTP 200 image/png           45319 B
/apple-touch-icon.png → HTTP 200 image/png          9671 B
/icons/icon-192x192.png → HTTP 200 image/png       10588 B
/manifest.webmanifest → HTTP 200 application/manifest+json  779 B
```

## Tags HTML servidos (inspección del DOM)

```
<link rel="shortcut icon" href="/favicon.ico">
<link rel="icon" href="/favicon.ico" sizes="any" type="image/x-icon">
<link rel="icon" href="/icons/icon-192x192.png" sizes="192x192" type="image/png">
<link rel="icon" href="/icons/icon-512x512.png" sizes="512x512" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:image" content="http://localhost:3000/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="http://localhost:3000/og-image.png">
```

## Manifest renderizado (raw JSON servido por Next)

```json
{
  "name": "AroundaPlanet - Viajes Increibles",
  "short_name": "AroundaPlanet",
  "description": "Plataforma digital de AroundaPlanet - agencia de viajes con Vuelta al Mundo",
  "start_url": "/", "scope": "/",
  "display": "standalone",
  "background_color": "#FAFAF8", "theme_color": "#1B4332",
  "orientation": "portrait-primary",
  "categories": ["travel"],
  "icons": [
    {"src": "/icons/icon-72x72.png", "sizes": "72x72", "type": "image/png", "purpose": "any"},
    {"src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "/icons/icon-512x512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    {"src": "/apple-touch-icon.png", "sizes": "180x180", "type": "image/png", "purpose": "any"}
  ]
}
```

## Capturas + assets entregados

| Archivo | Descripción |
|---|---|
| `01-icon-512.png` | PWA icon 512×512 estándar (logo color sobre blanco) |
| `01b-icon-512-maskable.png` | PWA icon 512×512 maskable (logo blanco sobre verde marca, 20% safe-area) |
| `01c-apple-touch.png` | apple-touch-icon 180×180 |
| `02-manifest-served.png` | viewport del navegador mostrando manifest.webmanifest JSON servido |
| `03-og-image.png` | OG image 1200×630 con composición final |
| `04-og-preview-context.png` | landing pública / con la home renderizada |

## Validaciones automatizadas

- `pnpm typecheck` ✅
- `pnpm lint` ✅ 0 errores (60 warnings pre-existentes)
- `pnpm vitest run` ✅ 1864 pass · 1 fail pre-existente RoleSidebar stale (no regresión)
- `pnpm build --webpack` ✅
- HTTP probes locales: 5/5 endpoints 200 con MIME correcto

## Cómo regenerar

```bash
pnpm tsx scripts/generate-pwa-assets.ts
```

Regenera los 7 assets en su ubicación final. Si el cliente entrega nuevo logo, basta con reemplazar `public/images/aroundaplanet-logo.png` y correr el comando.
