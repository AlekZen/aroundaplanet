# Smoke NS-03 — Links inline contrato + recibo PDF en /agent/clients

Fecha: 2026-05-20

## Qué entrega

Acciones inline por fila de orden en el modo "Por Cliente" de `/agent/clients`. Cada fila ahora muestra, según el estado de la orden:

| Estado de la orden | Acción mostrada |
|---|---|
| Sin contrato (Odoo legacy o plataforma sin generar) | Texto sutil `Contrato pendiente` |
| Con contrato + sin pagos verified | Botón `Ver contrato` + texto `Sin pagos verificados aún` |
| Con contrato + 1 pago verified | `Ver contrato` + botón primario `Recibo PDF` |
| Con contrato + N pagos verified | `Ver contrato` + botón primario `Recibos PDF (N)` con Popover que lista cada recibo por fecha + monto |

Responde al reporte WhatsApp de Noel: el agente no encontraba dónde descargar el contrato ni el recibo desde la pantalla donde busca a sus clientes.

## Componentes

1. **`GET /api/agent/orders-contract-map`** (nuevo) — retorna `{ orders: { [orderId]: { contractId, verifiedPayments: [{paymentId, amountCents, dateIso}] } } }` para todas las órdenes Firestore con `agentId === claims.agentId`. Permisos: requiere agentId en claims (403 si falta).
2. **`GroupedByClientView.tsx`** — recibe prop `orderActions?: Record<string, OrderActionEntry>` y renderiza el componente `OrderActions` por fila (desktop) o card (mobile). El componente decide variante (single button vs Popover con dropdown) según el número de pagos.
3. **`AgentClientList.tsx`** — fetch del nuevo endpoint en mount, pasa la prop al `GroupedByClientView`.

## Decisión de scope

Las acciones aparecen únicamente en el modo "Por Cliente" (GroupedByClientView) según el alcance literal del issue. El modo "Por Viaje" (GroupedByTripView) queda intencionalmente fuera del batch.

Las órdenes Odoo legacy (las que vienen del XML-RPC sin mirror Firestore) NO aparecen en el mapa del endpoint → renderizan `Contrato pendiente`. El agente entiende que falta paso de admin (asignar contrato o crear mirror desde `/admin/orders/[orderId]`).

## Resultado visual

| # | Captura | Comentario |
|---|---|---|
| 01 | `01-desktop-table-with-actions.png` | Tabla desktop con columna "Acciones" a la derecha de "Fuente". Cliente AARON SUAREZ LEON expandido — su orden `odoo-794` es Odoo legacy sin mirror → texto `Contrato pendiente` en cursiva. |
| 02 | `02-mobile-cards-with-actions.png` | Card mobile del mismo cliente AARON. Bloque inferior separado por border-top con el estado `Contrato pendiente`. |

**Nota smoke**: el agente de prueba con el que ejecuté el smoke local tiene 2 órdenes Firestore (1 con contractId, 0 con pagos verified) y 655 clientes Odoo legacy. Los botones reales "Ver contrato"/"Recibo PDF" aparecen en el cliente plataforma con contractId, no capturable en este screenshot porque ese cliente no está en las primeras filas alfabéticas. La lógica está cubierta por:

- Test del endpoint (5/5 pass) — incluye orden con contractId + dos pagos verified ordenados por fecha desc.
- Verificación directa del endpoint en prod: `curl /api/agent/orders-contract-map` retorna el shape esperado.
- Validación manual al recargar la página: cliente platform con contrato muestra el botón "Ver contrato" y abre `/api/contracts/{id}/url`.

Las capturas 03/04 (contrato/recibo abiertos) se validarán en prod con Noel/Felipe Rubio cuyo agente tiene historial real con contratos + pagos verified.

## Validaciones automatizadas

- `pnpm typecheck` ✅
- `pnpm lint` ✅ 0 errores (60 warnings pre-existentes)
- `pnpm vitest run src/app/api/agent/orders-contract-map/` ✅ 5/5 (401, 403, 200 con datos, 200 vacío, payment huérfano)
- `pnpm build --webpack` ✅
- HTTP probe local: `GET /api/agent/orders-contract-map` → 401 sin sesión (endpoint registrado).
