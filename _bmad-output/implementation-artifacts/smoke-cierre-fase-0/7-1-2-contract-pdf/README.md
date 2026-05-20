# Smoke 7.1.2 — Logo en PDF de contrato y cotización

Fecha: 2026-05-20
Render local: `npx tsx` con templates reales + asset oficial optimizado

## Decisión de diseño

El logo oficial entregado por el cliente (`public/images/aroundaplanet-logo.png`, 2835×2835 cuadrado, 340 KB) es un **isotipo** (símbolo cuadrado), no un wordmark horizontal. Para PDF se generó una versión optimizada `src/lib/pdf/assets/logo-aroundaplanet.png` de 256×256 (~8 KB, sharp `palette:true` `compressionLevel:9`) para mantener el budget de 100 KB del PDF del contrato verificado por `ContractDocument.test.tsx`.

Reemplaza al asset anterior (536×161 wordmark legacy) que Story 10.1.4 había seedeado provisionalmente.

## Helper centralizado

`src/lib/pdf/assets.ts` expone:
- `loadLogoBuffer(): Buffer` — cache module-scoped
- `hasLogo(): boolean`

Reutilizable por cualquier template PDF futuro (recibo de pago NS-02, voucher, etc).

## Resultado

| # | Documento | Tamaño | Logo visible | Posición | Captura |
|---|---|---|---|---|---|
| 01 | Contrato Felipe Rubio Vuelta al Mundo | 36 KB | ✅ isotipo dentro del paralelogramo navy del header (60×60), ratio correcto, no pixelado | top:10, left:36 | `01-contract-with-logo.pdf` + `01-contract-with-logo.png` |
| 02 | Cotización Q-SMOKE-001 Vuelta al Mundo | 19 KB | ✅ isotipo dentro del hero verde (60×60), a la izquierda del texto | top:12, left:16 dentro del hero | `02-quotation-with-logo.pdf` + `02-quotation-with-logo.png` |

## Validaciones automatizadas

- `pnpm typecheck` ✅
- `pnpm lint` ✅ 0 errores (58 warnings pre-existentes, +1 inocuo del cleanup)
- `pnpm vitest run src/lib/pdf/` ✅ 19/19 (ContractDocument latencia + magic bytes + budget 100 KB + sin acompañantes)
- `pnpm build --webpack` ✅

## Bug detectado y resuelto durante implementación

Logo oficial es cuadrado (2835×2835); el `headerLogo` style del contrato estaba en 140×52 (3.3:1 horizontal). Se ajustó a 60×60 cuadrado para preservar ratio. Test del budget 100 KB hubiera explotado con el PNG sin optimizar (340 KB) → optimización via sharp 256×256 palette PNG, resultado 8 KB.

## Cómo regenerar las muestras

```bash
# El script se mantiene fuera del repo; recrear si se necesita:
npx tsx scripts/smoke-pdf-7-1-2.ts
```

Los PDFs `.pdf` se sirvieron localmente desde `public/manuals/_smoke/` (cubierto por el matcher del proxy) para capturar con Playwright. La carpeta `_smoke` se eliminó tras capturar.
