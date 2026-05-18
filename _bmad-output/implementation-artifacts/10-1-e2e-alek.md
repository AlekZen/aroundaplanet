# Story 10.1 — Evidencia E2E asignación contrato a agente Alek

**Fecha:** 2026-05-18 · **Entorno:** localhost:3000 (`pnpm start` build prod) · **Operador:** Alek (admin+superadmin+agente)

## Datos del flujo

| Campo | Valor |
|---|---|
| orderId | `test-alek-e2e-10-1` (Firestore `orders/`) |
| contractId | `Fb3kHWuSkuu9qy5fvai6` (Firestore `contracts/`) |
| tripId piloto | `odoo-1748` — VUELTA AL MUNDO 2026 |
| agentId | `gif7XVStiEfOJFrBMCeECQOgJfZ2` (Alek) |
| amountTotalCents | `14500000` ($145,000.00 MXN) |
| version | 1 |
| PDF | 38,874 bytes · `application/pdf` · signed URL v4 (7 días) |

## Pasos ejecutados

1. **Order mirror creado** en Firestore directamente (Alek no tiene `odooTeamId` → ningún `sale.order` Odoo lo apuntaba). Campos mínimos para `from-order/generate`: `tripId`, `contactName`, `agentId`, `amountTotalCents`, `status='Confirmado'`.
2. **Admin → `/admin/orders/test-alek-e2e-10-1`** carga la card Contrato con banner verde "✓ Viaje configurado: VUELTA AL MUNDO · Plazo 60 días · 5 ítems INCLUYE".
3. Click **"Generar contrato PDF"** → respuesta 201 con `contractId=Fb3kHWuSkuu9qy5fvai6`, `version=1`. Card muestra "✅ Contrato v1 generado. Abrir PDF".
4. **Reload + toggle "Compartir con agente"** → POST `/api/contracts/.../share` 200; Firestore confirma `sharedWithAgent=true`, `sharedWithClient=false`.
5. **Agente → `/agent/contracts`** muestra tarjeta:
   - "VUELTA AL MUNDO · v1 · Pendiente de aceptar · Visible como agente"
   - Cliente: Cliente Prueba Alek E2E · Total $145,000.00 MXN · Agente Alek Zen
   - Botón "Ver / descargar PDF" enlaza al signed URL.
6. **`GET /api/contracts/Fb3kHWuSkuu9qy5fvai6/url`** devuelve signed URL fresca. `curl GET` al URL → `200 application/pdf 38874` bytes.

## Screenshot

`_bmad-output/implementation-artifacts/10-1-alek-contract-e2e.png` — captura full-page de `/agent/contracts` con el contrato listado.

## Validación

- ✅ Order → Contract → Visibilidad cliente/agente funciona end-to-end.
- ✅ `claims.agentId` propaga correctamente y `list-mine` filtra por él.
- ✅ Signed URL v4 entrega PDF binario (38KB) sin auth adicional.
- ✅ Sin regresiones observadas en flujo admin/agente.

## Datos de prueba a limpiar después

- Firestore `orders/test-alek-e2e-10-1`
- Firestore `contracts/Fb3kHWuSkuu9qy5fvai6`
- Storage `contracts/test-alek-e2e-10-1/Fb3kHWuSkuu9qy5fvai6.pdf`

## Bugs encontrados

Ninguno bloqueante. La validación E2E confirma que Story 10.1 (Sub-fase B contratos) opera correctamente para el rol agente.
