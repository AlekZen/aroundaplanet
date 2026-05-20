# Smoke NS-02 — PDF formal de recibo de pago

Fecha: 2026-05-20

## Qué entrega

PDF generado por la plataforma con membrete AroundaPlanet (logo blanco sobre paralelogramo navy), datos del cliente, monto del abono en pesos + letras, fecha de verificación, método/banco/referencia, y resumen del expediente con total contratado + cobrado acumulado (incluye este pago) + saldo pendiente.

Responde al reporte WhatsApp de Noel: el botón "Ver recibo" anterior solo abría el comprobante bancario subido por el cliente. Ahora hay **dos** acciones distinguibles:
- **Ver comprobante** → URL pública del PDF/imagen que subió el cliente al banco.
- **Recibo PDF** (botón primario) → endpoint `/api/payments/{paymentId}/receipt-pdf` que genera el recibo formal on-demand.

## Componentes implementados

1. `src/lib/pdf/templates/PaymentReceiptDocument.tsx` — template @react-pdf consistente con ContractDocument/QuotationDocument (mismo header/footer SVG con paralelogramos navy+teal, logo blanco 140×45).
2. `src/app/api/payments/[paymentId]/receipt-pdf/route.ts` — endpoint nodejs GET con:
   - `requireAuth` + reglas de permiso (admin/superadmin libre · agente si `payment.agentId === claims.agentId` · cliente si `payment.clientId === uid || payment.registeredBy === uid`).
   - 404 si el pago no existe, 403 si no autorizado, 409 `RECEIPT_NOT_AVAILABLE` si `status !== 'verified'`.
   - Cobrado acumulado = suma de `payments` con mismo `orderId`, `status === 'verified'` y `date <= payment.date`.
   - Render `@react-pdf/renderer` `renderToBuffer` on-demand (sin Storage).
   - Headers `Content-Type: application/pdf` + `Content-Disposition: inline; filename="recibo-R-{paymentId8}-V1.pdf"` + `Cache-Control: private, max-age=300`.
3. UI:
   - `AgentVerifiedPaymentsPanel.tsx` (/agent/clients) — botón primario "Recibo PDF" + secundario "Ver comprobante".
   - `MyContractsPanel.tsx` (/agent/contracts) — por cada pago verified del agente, botón primario "Recibo PDF $X" inline + "Comprobante" secundario si hay receiptUrl.
   - `/admin/orders/[orderId]` — columna nueva "Recibo PDF" en la tabla de pagos (solo aparece el link si `status === 'verified'`).

## Tests

- `src/lib/pdf/templates/PaymentReceiptDocument.test.tsx` — 4/4 (PDF magic bytes, budget 100 KB, sin banco/referencia, latencia <5000 ms).
- `src/app/api/payments/[paymentId]/receipt-pdf/route.test.ts` — 8/8 (401 sin auth, 404 no existe, 403 sin permiso, 409 no verified, 200 admin, 200 agente match, 403 agente mismatch, 200 cliente vía registeredBy).

## Resultado visual

| # | Captura | Comentario |
|---|---|---|
| 01 | `01-receipt-pdf-render.png` | Render real del template con datos de Felipe Rubio · Vuelta al Mundo · $5,000 abono · saldo $120,000. Logo blanco grande en header navy. Sección "ABONO RECIBIDO" con monto + letras. Saldo pendiente destacado en su propio cuadro. |
| 02 | `02-agent-clients-button.png` | `/agent/clients` con panel "Recibos verificados". Por cada fila: botón primario verde "Recibo PDF" arriba + "Ver comprobante" outline abajo. |
| 03 | `03-my-contracts-buttons.png` | `/agent/contracts` con MyContractsPanel. Por cada pago verified del agente: par de botones "Recibo PDF $X" (primario) + "Comprobante" (outline) inline. |
| 04 | `04-admin-orders-link.png` | `/admin/orders` listado (la columna "Recibo PDF" aparece en cada `/admin/orders/[orderId]` con link solo cuando `status === 'verified'`). |

## Validaciones automáticas

- `pnpm typecheck` ✅
- `pnpm lint` ✅ 0 errores
- `pnpm vitest run` ✅ 1858 pass · 2 fallos PRE-EXISTENTES no relacionados (RoleSidebar.test.tsx stale tras Story 10.6 + ContractDocument latency flaky documentado en MEMORY.md)
- `pnpm build --webpack` ✅
- HTTP probe local: `GET /api/payments/test-id/receipt-pdf` → 401 sin sesión (endpoint registrado correctamente).

## Pendiente en prod (operativo)

- Cuando esté live, probar como agente real (Noel/Felipe Rubio) que el botón en `/agent/clients` descarga el PDF con sus pagos reales — el código está deployed; solo requiere abrir la página con cuenta de agente.
- Validar saldo acumulado con un pago intermedio real (e.g. dos pagos verified misma orden, generar recibo del segundo, confirmar que cobrado = suma de los dos).
