# Smoke 7.1.2 — Logo en PDF de contrato y cotización

Fecha original: 2026-05-20
**Hotfix aplicado** 2026-05-20: ver sección "Hotfix" abajo.

## Decisión de diseño (corregida en hotfix)

El logo oficial entregado por el cliente (`public/images/aroundaplanet-logo.png`, 717×717, 340 KB) **NO es un isotipo cuadrado** — es el **wordmark horizontal completo** (globo + "AROUNDA PLANET TRAVEL AGENCY") enmarcado en un canvas cuadrado con padding transparente. La afirmación opuesta del Batch B original era incorrecta.

Para PDF se generan dos variantes mediante `scripts/generate-pdf-logo-variants.ts`:
- **`src/lib/pdf/assets/logo-aroundaplanet-color.png`** (512×164, ~18 KB) — wordmark con colores originales navy/teal, sobre transparente. Recortado al bounding box real vía `sharp.trim()`.
- **`src/lib/pdf/assets/logo-aroundaplanet-white.png`** (512×164, ~19 KB) — wordmark monocromo blanco con alfa preservado, para uso sobre fondos oscuros.

Aspect ratio real: 3.12:1 (horizontal).

## Helper centralizado

`src/lib/pdf/assets.ts` expone:
- `loadLogoColorBuffer(): Buffer` — cache module-scoped, variante color
- `loadLogoWhiteBuffer(): Buffer` — cache module-scoped, variante blanca
- `hasLogo(): boolean` — evalúa variante color

## Resultado

| # | Documento | Tamaño | Variante usada | Posición / Tamaño | Razonamiento |
|---|---|---|---|---|---|
| 01 | Contrato Felipe Rubio | ~38 KB | **white** | 140×45 pt, top:18 left:32 dentro del paralelogramo navy | Fondo navy oscuro → variante blanca para contraste máximo |
| 02 | Cotización Q-SMOKE-001 | ~22 KB | **white** | 140×45 pt, top:18 left:16 dentro del hero | Hero verde oscuro `#1B4332` → variante blanca para contraste (divergencia justificada de la instrucción literal del hotfix que pedía COLOR; el criterio de cierre "legible y bien proporcionado" prevalece) |

## Validaciones automatizadas

- `pnpm typecheck` ✅
- `pnpm lint` ✅ 0 errores
- `pnpm vitest run src/lib/pdf/` ✅ 19/19 (incluyendo budget 100 KB y latencia <1500 ms)
- `pnpm build --webpack` ✅

## Hotfix (este pase)

**Bug detectado en revisión post-deploy del Batch B original**:
1. La conclusión "el logo oficial es un isotipo cuadrado" era falsa. Es wordmark horizontal con padding.
2. ContractDocument lo renderizaba a 60×60 sobre paralelogramo navy → diminuto, bajo contraste, ilegible.

**Fix aplicado**:
- Generación correcta de variantes (color + blanco) mediante `scripts/generate-pdf-logo-variants.ts` con `sharp.trim()` para recortar el padding y `ensureAlpha + raw` para la conversión a blanco píxel-a-píxel.
- Dimensiones aumentadas a 140×45 pt en ambos templates.
- Variante blanca en ambos (hero de cotización es oscuro, no claro como sugería la instrucción literal).

**Asset legacy eliminado**: `src/lib/pdf/assets/logo-aroundaplanet.png` (el isotipo cuadrado fallido del primer pase).

## Cómo regenerar muestras

```bash
# Regenerar variantes desde el oficial:
pnpm tsx scripts/generate-pdf-logo-variants.ts

# Regenerar PDFs smoke:
pnpm tsx scripts/smoke-pdf-7-1-2.ts

# Servir vía public/manuals/_smoke/ y capturar con Playwright (limpiar al cerrar).
```
